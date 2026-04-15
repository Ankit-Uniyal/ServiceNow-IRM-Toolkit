/**
 * ServiceNow IRM Toolkit - Utility Scripts
 * Reusable utility functions and helper scripts for the IRM platform
 * Applies across: Risk, Compliance, Audit, VRM, BCM, Operational Resilience
 *
 * @author Ankit Uniyal
 * @version 2.0
 * @module IRM Utilities
 */

// =============================================================================
// SECTION 1: GLIDERECORD HELPER UTILITIES
// =============================================================================

/**
 * Safe GlideRecord getter - returns default value if field is empty
 * @param {GlideRecord} gr - GlideRecord instance
 * @param {string} field - Field name
 * @param {*} defaultValue - Default value if field is empty
 */
function safeGetValue(gr, field, defaultValue) {
    var val = gr.getValue(field);
    return (val !== null && val !== undefined && val !== '') ? val : (defaultValue !== undefined ? defaultValue : '');
}

/**
 * Safe GlideRecord display value getter
 * @param {GlideRecord} gr - GlideRecord instance
 * @param {string} field - Field name
 * @param {string} defaultValue - Default display value
 */
function safeGetDisplayValue(gr, field, defaultValue) {
    var val = gr.getDisplayValue(field);
    return (val !== null && val !== undefined && val !== '') ? val : (defaultValue || '');
}

/**
 * Execute a GlideRecord query and return results as array of objects
 * @param {string} tableName - Table name to query
 * @param {Object} conditions - Key-value pairs for query conditions
 * @param {Array} fields - Array of field names to retrieve
 * @param {Object} options - Options: limit, orderBy, orderByDesc, active
 */
function queryToArray(tableName, conditions, fields, options) {
    var opts = options || {};
    var results = [];
    var gr = new GlideRecord(tableName);
    
    if (opts.active !== false) gr.addQuery('active', true);
    
    Object.keys(conditions || {}).forEach(function(key) {
        var val = conditions[key];
        if (Array.isArray(val)) {
            gr.addQuery(key, 'IN', val.join(','));
        } else if (typeof val === 'object' && val.operator) {
            gr.addQuery(key, val.operator, val.value);
        } else {
            gr.addQuery(key, val);
        }
    });
    
    if (opts.orderBy) gr.orderBy(opts.orderBy);
    if (opts.orderByDesc) gr.orderByDesc(opts.orderByDesc);
    if (opts.limit) gr.setLimit(opts.limit);
    
    gr.query();
    while (gr.next()) {
        var row = { sys_id: gr.getUniqueValue() };
        (fields || []).forEach(function(field) {
            var fieldDef = typeof field === 'object' ? field : { name: field };
            row[fieldDef.alias || fieldDef.name] = fieldDef.display
                ? gr.getDisplayValue(fieldDef.name)
                : gr.getValue(fieldDef.name);
        });
        results.push(row);
    }
    return results;
}

/**
 * Check if a record exists matching given conditions
 * @param {string} tableName - Table to check
 * @param {Object} conditions - Field-value conditions
 */
function recordExists(tableName, conditions) {
    var gr = new GlideRecord(tableName);
    Object.keys(conditions).forEach(function(key) {
        gr.addQuery(key, conditions[key]);
    });
    gr.setLimit(1);
    gr.query();
    return gr.next();
}

/**
 * Get count of records matching conditions
 * @param {string} tableName - Table to count
 * @param {Object} conditions - Field-value conditions
 */
function getRecordCount(tableName, conditions) {
    var ga = new GlideAggregate(tableName);
    ga.addAggregate('COUNT');
    Object.keys(conditions || {}).forEach(function(key) {
        ga.addQuery(key, conditions[key]);
    });
    ga.query();
    return ga.next() ? parseInt(ga.getAggregate('COUNT')) : 0;
}

// =============================================================================
// SECTION 2: DATE AND TIME UTILITIES
// =============================================================================

/**
 * Add working days to a GlideDateTime (skips weekends)
 * @param {GlideDateTime} startDate - Start date
 * @param {number} workingDays - Number of working days to add
 */
function addWorkingDays(startDate, workingDays) {
    var result = new GlideDateTime(startDate.getValue());
    var daysAdded = 0;
    while (daysAdded < workingDays) {
        result.addDaysLocalTime(1);
        var dayOfWeek = result.getDayOfWeekLocalTime();
        if (dayOfWeek !== 1 && dayOfWeek !== 7) daysAdded++;  // Skip Sat (7) and Sun (1)
    }
    return result;
}

/**
 * Calculate business days between two dates
 * @param {GlideDateTime} startDate - Start date
 * @param {GlideDateTime} endDate - End date
 */
function getWorkingDaysBetween(startDate, endDate) {
    var current = new GlideDateTime(startDate.getValue());
    var count = 0;
    while (current.compareTo(endDate) < 0) {
        current.addDaysLocalTime(1);
        var dayOfWeek = current.getDayOfWeekLocalTime();
        if (dayOfWeek !== 1 && dayOfWeek !== 7) count++;
    }
    return count;
}

/**
 * Format a GlideDateTime to a human-readable string
 * @param {string} dateTimeValue - Date value from GlideRecord
 * @param {string} format - Format: 'date', 'datetime', 'relative'
 */
function formatDateTime(dateTimeValue, format) {
    if (!dateTimeValue) return 'N/A';
    var gdt = new GlideDateTime(dateTimeValue);
    if (format === 'date') return gdt.getDate().getDisplayValue();
    if (format === 'relative') {
        var now = new GlideDateTime();
        var diff = GlideDateTime.subtract(gdt, now);
        var days = Math.abs(diff.getRoundedDayPart());
        var direction = gdt.compareTo(now) > 0 ? 'from now' : 'ago';
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ' + direction;
        return days + ' days ' + direction;
    }
    return gdt.getDisplayValue();
}

/**
 * Get the fiscal quarter for a date
 * @param {GlideDateTime} date - Date to get fiscal quarter for
 * @param {number} fiscalYearStartMonth - Month number when fiscal year starts (1-12)
 */
function getFiscalQuarter(date, fiscalYearStartMonth) {
    var month = date.getMonthLocalTime();
    var year = date.getYearLocalTime();
    var startMonth = fiscalYearStartMonth || 1;
    
    // Adjust month relative to fiscal year start
    var adjustedMonth = ((month - startMonth + 12) % 12) + 1;
    var quarter = Math.ceil(adjustedMonth / 3);
    
    // Calculate fiscal year
    var fiscalYear = month >= startMonth ? year : year - 1;
    
    return { quarter: quarter, fiscal_year: fiscalYear, label: 'Q' + quarter + ' FY' + fiscalYear };
}

// =============================================================================
// SECTION 3: NOTIFICATION AND EVENT UTILITIES
// =============================================================================

/**
 * Queue a ServiceNow event for notification processing
 * @param {string} eventName - Event name (e.g., 'irm.risk.high')
 * @param {GlideRecord} gr - Source GlideRecord
 * @param {string} parm1 - Event parameter 1
 * @param {string} parm2 - Event parameter 2
 */
function queueIRMEvent(eventName, gr, parm1, parm2) {
    try {
        gs.eventQueue(eventName, gr, parm1 || '', parm2 || '');
        gs.info('IRM Event queued: ' + eventName + ' for ' + gr.getTableName() + ':' + gr.getUniqueValue());
        return true;
    } catch (e) {
        gs.error('IRM Event Error: ' + eventName + ' - ' + e.message);
        return false;
    }
}

/**
 * Send an email notification using a notification record
 * @param {string} notificationSysId - sys_id of the notification record
 * @param {string} recipientSysId - sys_id of recipient user
 * @param {Object} templateVars - Template variable substitutions
 */
function sendIRMNotification(notificationSysId, recipientSysId, templateVars) {
    try {
        var email = new GlideEmailOutbound();
        var notifGr = new GlideRecord('sysevent_email_action');
        if (notifGr.get(notificationSysId)) {
            var userGr = new GlideRecord('sys_user');
            if (userGr.get(recipientSysId)) {
                email.addRecipient(userGr.getValue('email'));
                gs.info('IRM Notification: Queued email to ' + userGr.getValue('email'));
                return true;
            }
        }
        return false;
    } catch (e) {
        gs.error('IRM Notification Error: ' + e.message);
        return false;
    }
}

// =============================================================================
// SECTION 4: IRM SCORING AND CALCULATION UTILITIES
// =============================================================================

/**
 * Calculate inherent risk score (Likelihood x Impact)
 * @param {number} likelihood - Likelihood score (1-5)
 * @param {number} impact - Impact score (1-5)
 */
function calculateInherentRisk(likelihood, impact) {
    var score = likelihood * impact;
    var rating;
    if (score >= 16) rating = 'critical';
    else if (score >= 9) rating = 'high';
    else if (score >= 4) rating = 'medium';
    else rating = 'low';
    return { score: score, rating: rating, likelihood: likelihood, impact: impact };
}

/**
 * Calculate residual risk after control effectiveness
 * @param {number} inherentScore - Inherent risk score
 * @param {number} controlEffectiveness - Control effectiveness percentage (0-100)
 */
function calculateResidualRisk(inherentScore, controlEffectiveness) {
    var reduction = (controlEffectiveness / 100) * inherentScore;
    var residualScore = Math.max(0, inherentScore - reduction);
    var rating;
    if (residualScore >= 16) rating = 'critical';
    else if (residualScore >= 9) rating = 'high';
    else if (residualScore >= 4) rating = 'medium';
    else rating = 'low';
    return { score: Math.round(residualScore * 100) / 100, rating: rating, reduction: reduction };
}

/**
 * Calculate compliance score as a percentage
 * @param {string} entitySysId - Entity sys_id to calculate compliance for
 * @param {string} framework - Framework name (optional filter)
 */
function calculateComplianceScore(entitySysId, framework) {
    var total = 0;
    var compliant = 0;
    
    var gr = new GlideRecord('sn_compliance_control');
    gr.addQuery('applicable_entity', entitySysId);
    if (framework) gr.addQuery('framework', framework);
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        total++;
        var status = gr.getValue('state');
        if (status === 'compliant' || status === 'effective') compliant++;
    }
    
    var score = total > 0 ? Math.round((compliant / total) * 100) : 0;
    return {
        total_controls: total,
        compliant_controls: compliant,
        non_compliant: total - compliant,
        score_percentage: score,
        rating: score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'needs_improvement' : 'poor'
    };
}

/**
 * Calculate KRI (Key Risk Indicator) breach status
 * @param {number} currentValue - Current KRI value
 * @param {number} threshold - Red threshold value
 * @param {number} warningThreshold - Amber threshold value
 * @param {string} direction - 'higher_is_worse' or 'lower_is_worse'
 */
function evaluateKRI(currentValue, threshold, warningThreshold, direction) {
    var isHigherWorse = direction !== 'lower_is_worse';
    var status, color;
    
    if (isHigherWorse) {
        if (currentValue >= threshold) { status = 'breach'; color = 'red'; }
        else if (currentValue >= warningThreshold) { status = 'warning'; color = 'amber'; }
        else { status = 'within_appetite'; color = 'green'; }
    } else {
        if (currentValue <= threshold) { status = 'breach'; color = 'red'; }
        else if (currentValue <= warningThreshold) { status = 'warning'; color = 'amber'; }
        else { status = 'within_appetite'; color = 'green'; }
    }
    
    return { status: status, color: color, current_value: currentValue, threshold: threshold, warning_threshold: warningThreshold };
}

// =============================================================================
// SECTION 5: DATA EXPORT AND REPORTING UTILITIES
// =============================================================================

/**
 * Convert GlideRecord results to CSV format string
 * @param {Array} data - Array of objects from queryToArray
 * @param {Array} columns - Column definitions [{field, header}]
 */
function arrayToCSV(data, columns) {
    if (!data || data.length === 0) return '';
    
    var cols = columns || Object.keys(data[0]).map(function(k) { return { field: k, header: k }; });
    var csv = cols.map(function(c) { return '"' + c.header + '"'; }).join(',') + '\n';
    
    data.forEach(function(row) {
        csv += cols.map(function(c) {
            var val = row[c.field] || '';
            return '"' + String(val).replace(/"/g, '""') + '"';
        }).join(',') + '\n';
    });
    
    return csv;
}

/**
 * Generate a standardized IRM report object
 * @param {string} reportType - Type of report
 * @param {Object} data - Report data
 * @param {Object} metadata - Report metadata
 */
function buildIRMReport(reportType, data, metadata) {
    return {
        report_type: reportType,
        generated_at: new GlideDateTime().getDisplayValue(),
        generated_by: gs.getUserDisplayName(),
        instance: gs.getProperty('instance_name'),
        metadata: metadata || {},
        data: data,
        record_count: Array.isArray(data) ? data.length : Object.keys(data).length
    };
}

// =============================================================================
// SECTION 6: AUDIT TRAIL AND LOGGING UTILITIES
// =============================================================================

/**
 * Log an IRM activity to the audit log
 * @param {string} action - Action performed
 * @param {string} tableName - Table affected
 * @param {string} sysId - Record sys_id
 * @param {Object} details - Additional details
 */
function logIRMActivity(action, tableName, sysId, details) {
    try {
        var auditGr = new GlideRecord('sys_audit');
        auditGr.initialize();
        auditGr.setValue('documentkey', sysId);
        auditGr.setValue('tablename', tableName);
        auditGr.setValue('fieldname', 'irm_activity');
        auditGr.setValue('newvalue', JSON.stringify({ action: action, details: details, user: gs.getUserID() }));
        auditGr.insert();
        
        gs.info('[IRM Audit] ' + action + ' on ' + tableName + ':' + sysId + ' by ' + gs.getUserDisplayName());
        return true;
    } catch (e) {
        gs.error('[IRM Audit Error] ' + e.message);
        return false;
    }
}

/**
 * Create a standardized IRM log entry
 * @param {string} level - Log level: 'info', 'warn', 'error'
 * @param {string} module - IRM module (risk, compliance, audit, vrm, bcm)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 */
function irmLog(level, module, message, context) {
    var prefix = '[IRM-' + module.toUpperCase() + '] ';
    var fullMessage = prefix + message + (context ? ' | Context: ' + JSON.stringify(context) : '');
    
    switch (level) {
        case 'error': gs.error(fullMessage); break;
        case 'warn': gs.warn(fullMessage); break;
        default: gs.info(fullMessage);
    }
}

// =============================================================================
// SECTION 7: VALIDATION UTILITIES
// =============================================================================

/**
 * Validate that a sys_id exists in a given table
 * @param {string} tableName - Table to check
 * @param {string} sysId - sys_id to validate
 */
function validateSysId(tableName, sysId) {
    if (!sysId || sysId.length !== 32) return { valid: false, error: 'Invalid sys_id format' };
    var gr = new GlideRecord(tableName);
    gr.addQuery('sys_id', sysId);
    gr.setLimit(1);
    gr.query();
    return gr.next() ? { valid: true } : { valid: false, error: 'Record not found in ' + tableName };
}

/**
 * Validate required fields before record creation/update
 * @param {Object} data - Data object to validate
 * @param {Array} requiredFields - Array of required field names
 */
function validateRequiredFields(data, requiredFields) {
    var missing = [];
    requiredFields.forEach(function(field) {
        if (!data[field] && data[field] !== 0 && data[field] !== false) {
            missing.push(field);
        }
    });
    return { valid: missing.length === 0, missing_fields: missing };
}

/**
 * Validate a date range
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @param {boolean} allowPastDates - Whether past start dates are allowed
 */
function validateDateRange(startDate, endDate, allowPastDates) {
    var start = new GlideDateTime(startDate);
    var end = new GlideDateTime(endDate);
    var now = new GlideDateTime();
    
    var errors = [];
    if (!allowPastDates && start.compareTo(now) < 0) {
        errors.push('Start date cannot be in the past');
    }
    if (end.compareTo(start) <= 0) {
        errors.push('End date must be after start date');
    }
    return { valid: errors.length === 0, errors: errors };
}

// =============================================================================
// SECTION 8: BATCH PROCESSING UTILITIES
// =============================================================================

/**
 * Process records in batches to avoid memory/performance issues
 * @param {string} tableName - Table to process
 * @param {Object} conditions - Query conditions
 * @param {Function} processor - Function to call for each record
 * @param {number} batchSize - Records per batch (default: 100)
 */
function batchProcessRecords(tableName, conditions, processor, batchSize) {
    var batch = batchSize || 100;
    var offset = 0;
    var processed = 0;
    var errors = 0;
    var hasMore = true;
    
    while (hasMore) {
        var gr = new GlideRecord(tableName);
        Object.keys(conditions || {}).forEach(function(key) {
            gr.addQuery(key, conditions[key]);
        });
        gr.chooseWindow(offset, offset + batch);
        gr.query();
        
        var batchCount = 0;
        while (gr.next()) {
            try {
                processor(gr);
                processed++;
            } catch (e) {
                gs.error('Batch Process Error on ' + tableName + ':' + gr.getUniqueValue() + ' - ' + e.message);
                errors++;
            }
            batchCount++;
        }
        
        if (batchCount < batch) {
            hasMore = false;
        } else {
            offset += batch;
        }
    }
    
    irmLog('info', 'utility', 'Batch processing complete', { table: tableName, processed: processed, errors: errors });
    return { processed: processed, errors: errors };
}

/**
 * Deduplication utility - find and report duplicate records
 * @param {string} tableName - Table to check for duplicates
 * @param {Array} uniqueFields - Fields that should be unique together
 */
function findDuplicateRecords(tableName, uniqueFields) {
    var duplicates = [];
    var ga = new GlideAggregate(tableName);
    ga.addQuery('active', true);
    uniqueFields.forEach(function(field) { ga.groupBy(field); });
    ga.addAggregate('COUNT');
    ga.addHaving('COUNT', '>', '1');
    ga.query();
    
    while (ga.next()) {
        var dupInfo = { count: parseInt(ga.getAggregate('COUNT')), fields: {} };
        uniqueFields.forEach(function(field) { dupInfo.fields[field] = ga.getValue(field); });
        duplicates.push(dupInfo);
    }
    
    return { duplicate_groups: duplicates, total_groups: duplicates.length };
}

// =============================================================================
// SECTION 9: IRM SYSTEM PROPERTY UTILITIES
// =============================================================================

/**
 * Get IRM system property with fallback default
 * @param {string} propertyName - Property name
 * @param {string} defaultValue - Default if property not set
 */
function getIRMProperty(propertyName, defaultValue) {
    var value = gs.getProperty(propertyName);
    return (value !== null && value !== undefined && value !== '') ? value : (defaultValue || '');
}

/**
 * Set IRM system property
 * @param {string} propertyName - Property name
 * @param {string} value - Property value
 * @param {string} description - Property description
 */
function setIRMProperty(propertyName, value, description) {
    try {
        gs.setProperty(propertyName, value, description || '');
        irmLog('info', 'utility', 'Property set: ' + propertyName);
        return true;
    } catch (e) {
        irmLog('error', 'utility', 'Failed to set property: ' + propertyName, { error: e.message });
        return false;
    }
}

/**
 * Get current IRM module configuration
 */
function getIRMConfiguration() {
    return {
        risk_scoring_model: getIRMProperty('sn_risk.risk_scoring_model', 'likelihood_impact'),
        risk_appetite_threshold: getIRMProperty('sn_risk.appetite_threshold', '9'),
        audit_year: getIRMProperty('sn_audit.current_audit_year', new GlideDateTime().getYearLocalTime()),
        compliance_due_day: getIRMProperty('sn_compliance.assessment_due_day', '30'),
        vrm_tier1_review_months: getIRMProperty('sn_vrm.tier1_review_months', '6'),
        bcm_rto_default_hours: getIRMProperty('sn_bcm.default_rto_hours', '24'),
        notification_enabled: getIRMProperty('sn_irm.notifications_enabled', 'true') === 'true'
    };
}
