/**
 * ServiceNow IRM Toolkit - Vendor Risk Management (VRM) Scripts
 * Comprehensive GlideRecord scripts for the VRM module
 * Tables: sn_vdr_vendor_assessment, sn_vdr_vendor, sn_vdr_finding, sn_vdr_subvendor
 *
 * @author Ankit Uniyal
 * @version 2.0
 * @module Vendor Risk Management
 */

// =============================================================================
// SECTION 1: VENDOR ASSESSMENT QUERIES
// =============================================================================

/**
 * Get all vendor assessments filtered by status
 * @param {string} status - State value (draft, in_progress, completed, closed)
 */
function getVendorAssessmentsByStatus(status) {
    var results = [];
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.addQuery('state', status);
    gr.addQuery('active', true);
    gr.orderByDesc('sys_created_on');
    gr.query();
    while (gr.next()) {
        results.push({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            vendor: gr.getDisplayValue('vendor'),
            vendor_sys_id: gr.getValue('vendor'),
            state: gr.getDisplayValue('state'),
            risk_rating: gr.getDisplayValue('risk_rating'),
            score: gr.getValue('score'),
            assessment_type: gr.getDisplayValue('assessment_type'),
            due_date: gr.getValue('due_date'),
            assigned_to: gr.getDisplayValue('assigned_to'),
            created_on: gr.getValue('sys_created_on')
        });
    }
    return results;
}

/**
 * Get all high and critical risk vendors
 */
function getHighRiskVendors() {
    var results = [];
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    var qc = gr.addQuery('risk_rating', 'high');
    qc.addOrCondition('risk_rating', 'critical');
    gr.addQuery('state', 'completed');
    gr.addQuery('is_current', true);
    gr.orderByDesc('score');
    gr.query();
    while (gr.next()) {
        results.push({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            vendor: gr.getDisplayValue('vendor'),
            risk_rating: gr.getDisplayValue('risk_rating'),
            score: gr.getValue('score'),
            remediation_status: gr.getDisplayValue('remediation_status'),
            next_review_date: gr.getValue('next_review_date'),
            relationship_owner: gr.getDisplayValue('relationship_owner')
        });
    }
    return results;
}

/**
 * Get overdue vendor assessments
 */
function getOverdueVendorAssessments() {
    var results = [];
    var now = new GlideDateTime();
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.addQuery('state', 'IN', 'draft,in_progress');
    gr.addQuery('due_date', '<', now.getValue());
    gr.addQuery('active', true);
    gr.orderBy('due_date');
    gr.query();
    while (gr.next()) {
        var dueDate = gr.getGlideObject('due_date');
        var daysOverdue = 0;
        if (dueDate) {
            daysOverdue = Math.abs(GlideDateTime.subtract(now, dueDate).getRoundedDayPart());
        }
        results.push({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            vendor: gr.getDisplayValue('vendor'),
            due_date: gr.getValue('due_date'),
            days_overdue: daysOverdue,
            assigned_to: gr.getDisplayValue('assigned_to'),
            relationship_owner: gr.getDisplayValue('relationship_owner'),
            criticality_tier: gr.getDisplayValue('criticality_tier')
        });
    }
    return results;
}

// =============================================================================
// SECTION 2: VENDOR ASSESSMENT LIFECYCLE MANAGEMENT
// =============================================================================

/**
 * Create a new vendor risk assessment
 * @param {Object} assessmentData - Assessment configuration data
 */
function createVendorAssessment(assessmentData) {
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.initialize();
    gr.setValue('vendor', assessmentData.vendorSysId);
    gr.setValue('assessment_type', assessmentData.assessmentType || 'annual');
    gr.setValue('assigned_to', assessmentData.assignedTo);
    gr.setValue('due_date', assessmentData.dueDate);
    gr.setValue('description', assessmentData.description || '');
    gr.setValue('state', 'draft');
    gr.setValue('active', true);
    gr.setValue('criticality_tier', assessmentData.criticalityTier);
    gr.setValue('data_classification', assessmentData.dataClassification);
    gr.setValue('contract_value', assessmentData.contractValue || 0);
    var sysId = gr.insert();
    gs.info('VRM: Created assessment ' + gr.getValue('number') + ' for vendor ' + assessmentData.vendorSysId);
    return sysId;
}

/**
 * Update assessment score and auto-calculate risk rating
 * @param {string} assessmentSysId - Assessment sys_id
 * @param {number} score - Numeric score (0-100)
 */
function updateVendorAssessmentScore(assessmentSysId, score) {
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    if (!gr.get(assessmentSysId)) {
        gs.error('VRM: Assessment not found: ' + assessmentSysId);
        return false;
    }
    gr.setValue('score', score);
    var riskRating = score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical';
    gr.setValue('risk_rating', riskRating);
    gr.setValue('score_date', new GlideDateTime());
    gr.update();
    gs.info('VRM: Score updated for ' + gr.getValue('number') + ' - Score: ' + score + ', Rating: ' + riskRating);
    return true;
}

/**
 * Complete a vendor assessment and update vendor profile
 * @param {string} assessmentSysId - Assessment sys_id
 * @param {Object} completionData - Completion details including finalScore, riskRating, notes
 */
function completeVendorAssessment(assessmentSysId, completionData) {
    var asmtGr = new GlideRecord('sn_vdr_vendor_assessment');
    if (!asmtGr.get(assessmentSysId)) {
        gs.error('VRM: Assessment not found: ' + assessmentSysId);
        return false;
    }
    asmtGr.setValue('state', 'completed');
    asmtGr.setValue('completion_date', new GlideDateTime());
    asmtGr.setValue('score', completionData.finalScore);
    asmtGr.setValue('risk_rating', completionData.riskRating);
    asmtGr.setValue('completed_by', gs.getUserID());
    asmtGr.setValue('assessor_notes', completionData.notes || '');
    asmtGr.setValue('is_current', true);

    // Calculate next review based on risk rating
    var nextReview = new GlideDateTime();
    var reviewMonths = { critical: 3, high: 6, medium: 12, low: 24 };
    nextReview.addMonthsLocalTime(reviewMonths[completionData.riskRating] || 12);
    asmtGr.setValue('next_review_date', nextReview.getValue());
    asmtGr.update();

    // Mark previous assessments as not current
    var prevGr = new GlideRecord('sn_vdr_vendor_assessment');
    prevGr.addQuery('vendor', asmtGr.getValue('vendor'));
    prevGr.addQuery('sys_id', '!=', assessmentSysId);
    prevGr.addQuery('is_current', true);
    prevGr.query();
    while (prevGr.next()) {
        prevGr.setValue('is_current', false);
        prevGr.update();
    }

    // Update vendor record
    var vendorGr = new GlideRecord('sn_vdr_vendor');
    if (vendorGr.get(asmtGr.getValue('vendor'))) {
        vendorGr.setValue('current_risk_rating', completionData.riskRating);
        vendorGr.setValue('last_assessment_date', new GlideDateTime());
        vendorGr.setValue('next_assessment_date', nextReview.getValue());
        vendorGr.update();
    }

    gs.info('VRM: Assessment ' + asmtGr.getValue('number') + ' completed with rating: ' + completionData.riskRating);
    return true;
}

// =============================================================================
// SECTION 3: VENDOR MANAGEMENT
// =============================================================================

/**
 * Get vendors grouped by criticality tier
 */
function getVendorsByCriticalityTier() {
    var tiers = { tier1: [], tier2: [], tier3: [] };
    var gr = new GlideRecord('sn_vdr_vendor');
    gr.addQuery('active', true);
    gr.orderBy('name');
    gr.query();
    while (gr.next()) {
        var tier = gr.getValue('criticality_tier') || 'tier3';
        var vendorInfo = {
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            tier: gr.getDisplayValue('criticality_tier'),
            relationship_owner: gr.getDisplayValue('relationship_owner'),
            data_classification: gr.getDisplayValue('data_classification'),
            contract_expiry: gr.getValue('contract_expiry'),
            last_assessment_date: gr.getValue('last_assessment_date'),
            current_risk_rating: gr.getDisplayValue('current_risk_rating')
        };
        if (tiers[tier]) tiers[tier].push(vendorInfo);
        else tiers.tier3.push(vendorInfo);
    }
    return tiers;
}

/**
 * Get vendors with expiring contracts
 * @param {number} daysAhead - Days to look ahead (default: 90)
 */
function getExpiringVendorContracts(daysAhead) {
    var results = [];
    var now = new GlideDateTime();
    var futureDate = new GlideDateTime();
    futureDate.addDaysLocalTime(daysAhead || 90);
    var gr = new GlideRecord('sn_vdr_vendor');
    gr.addQuery('active', true);
    gr.addQuery('contract_expiry', '>=', now.getValue());
    gr.addQuery('contract_expiry', '<=', futureDate.getValue());
    gr.orderBy('contract_expiry');
    gr.query();
    while (gr.next()) {
        results.push({
            sys_id: gr.getUniqueValue(),
            vendor_name: gr.getValue('name'),
            contract_expiry: gr.getValue('contract_expiry'),
            relationship_owner: gr.getDisplayValue('relationship_owner'),
            criticality_tier: gr.getDisplayValue('criticality_tier'),
            current_risk_rating: gr.getDisplayValue('current_risk_rating'),
            auto_renew: gr.getDisplayValue('auto_renew')
        });
    }
    return results;
}

/**
 * Create new vendor onboarding assessment based on criticality
 * @param {string} vendorSysId - Vendor sys_id
 * @param {Object} onboardingData - Onboarding configuration
 */
function initiateVendorOnboardingAssessment(vendorSysId, onboardingData) {
    var tier = onboardingData.criticalityTier;
    var assessmentType = tier === 'tier1' ? 'full_assessment' :
                         tier === 'tier2' ? 'standard_assessment' : 'lite_assessment';

    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.initialize();
    gr.setValue('vendor', vendorSysId);
    gr.setValue('assessment_type', assessmentType);
    gr.setValue('state', 'draft');
    gr.setValue('active', true);
    gr.setValue('criticality_tier', tier);
    gr.setValue('data_classification', onboardingData.dataClassification);
    gr.setValue('data_access', onboardingData.dataAccess);
    gr.setValue('contract_value', onboardingData.contractValue);
    gr.setValue('services_provided', onboardingData.servicesProvided);
    gr.setValue('assigned_to', onboardingData.relationshipOwner);

    var dueDate = new GlideDateTime();
    var dueDays = { tier1: 14, tier2: 30, tier3: 45 };
    dueDate.addDaysLocalTime(dueDays[tier] || 30);
    gr.setValue('due_date', dueDate.getValue());

    var sysId = gr.insert();
    gs.info('VRM Onboarding: Created ' + assessmentType + ' for vendor ' + vendorSysId);
    return { sys_id: sysId, number: gr.getValue('number'), assessment_type: assessmentType, due_date: dueDate.getDisplayValue() };
}

// =============================================================================
// SECTION 4: BULK OPERATIONS
// =============================================================================

/**
 * Bulk initiate annual assessments for all active vendors
 * @param {string} assessmentType - Type of assessment
 * @param {string} dueDate - Due date (YYYY-MM-DD)
 */
function bulkInitiateVendorAssessments(assessmentType, dueDate) {
    var results = { created: 0, skipped: 0, errors: 0, created_ids: [] };
    var vendorGr = new GlideRecord('sn_vdr_vendor');
    vendorGr.addQuery('active', true);
    vendorGr.addQuery('requires_assessment', true);
    vendorGr.query();
    while (vendorGr.next()) {
        try {
            var existingGr = new GlideRecord('sn_vdr_vendor_assessment');
            existingGr.addQuery('vendor', vendorGr.getUniqueValue());
            existingGr.addQuery('assessment_type', assessmentType);
            existingGr.addActiveQuery();
            existingGr.setLimit(1);
            existingGr.query();
            if (existingGr.next()) { results.skipped++; continue; }

            var asmtGr = new GlideRecord('sn_vdr_vendor_assessment');
            asmtGr.initialize();
            asmtGr.setValue('vendor', vendorGr.getUniqueValue());
            asmtGr.setValue('assessment_type', assessmentType);
            asmtGr.setValue('due_date', dueDate);
            asmtGr.setValue('state', 'draft');
            asmtGr.setValue('active', true);
            asmtGr.setValue('assigned_to', vendorGr.getValue('relationship_owner'));
            var sysId = asmtGr.insert();
            results.created++;
            results.created_ids.push(sysId);
        } catch (e) {
            gs.error('VRM Bulk Error for ' + vendorGr.getValue('name') + ': ' + e.message);
            results.errors++;
        }
    }
    gs.info('VRM Bulk: Created=' + results.created + ', Skipped=' + results.skipped + ', Errors=' + results.errors);
    return results;
}

// =============================================================================
// SECTION 5: REPORTING AND ANALYTICS
// =============================================================================

/**
 * Generate executive summary of vendor risk posture
 */
function getVendorRiskSummary() {
    var summary = {
        total_vendors: 0,
        total_assessments: 0,
        by_rating: { critical: 0, high: 0, medium: 0, low: 0, unrated: 0 },
        by_tier: { tier1: 0, tier2: 0, tier3: 0 },
        overdue_assessments: 0,
        vendors_without_assessment: 0,
        avg_score: 0,
        expiring_contracts_90days: 0
    };

    // Count vendors
    var vendorGr = new GlideRecord('sn_vdr_vendor');
    vendorGr.addQuery('active', true);
    vendorGr.query();
    while (vendorGr.next()) {
        summary.total_vendors++;
        var tier = vendorGr.getValue('criticality_tier') || 'tier3';
        if (summary.by_tier[tier] !== undefined) summary.by_tier[tier]++;
        var rating = vendorGr.getValue('current_risk_rating') || 'unrated';
        if (summary.by_rating[rating] !== undefined) summary.by_rating[rating]++;

        // Check for assessment
        var hasAsmt = new GlideRecord('sn_vdr_vendor_assessment');
        hasAsmt.addQuery('vendor', vendorGr.getUniqueValue());
        hasAsmt.addQuery('state', 'completed');
        hasAsmt.setLimit(1);
        hasAsmt.query();
        if (!hasAsmt.next()) summary.vendors_without_assessment++;
    }

    // Overdue assessments
    var now = new GlideDateTime();
    var overdueGr = new GlideRecord('sn_vdr_vendor_assessment');
    overdueGr.addQuery('state', 'IN', 'draft,in_progress');
    overdueGr.addQuery('due_date', '<', now.getValue());
    overdueGr.addQuery('active', true);
    overdueGr.query();
    summary.overdue_assessments = overdueGr.getRowCount();

    // Expiring contracts
    var futureDate = new GlideDateTime();
    futureDate.addDaysLocalTime(90);
    var contractGr = new GlideRecord('sn_vdr_vendor');
    contractGr.addQuery('active', true);
    contractGr.addQuery('contract_expiry', '>=', now.getValue());
    contractGr.addQuery('contract_expiry', '<=', futureDate.getValue());
    contractGr.query();
    summary.expiring_contracts_90days = contractGr.getRowCount();

    return summary;
}

/**
 * Get vendor risk trend analysis over time
 * @param {string} vendorSysId - Vendor sys_id
 * @param {number} months - Months to analyze (default: 12)
 */
function getVendorRiskTrend(vendorSysId, months) {
    var trend = [];
    var startDate = new GlideDateTime();
    startDate.addMonthsLocalTime(-(months || 12));

    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.addQuery('vendor', vendorSysId);
    gr.addQuery('state', 'completed');
    gr.addQuery('sys_created_on', '>=', startDate.getValue());
    gr.orderBy('completion_date');
    gr.query();

    while (gr.next()) {
        trend.push({
            number: gr.getValue('number'),
            score: parseFloat(gr.getValue('score') || '0'),
            risk_rating: gr.getDisplayValue('risk_rating'),
            completion_date: gr.getValue('completion_date'),
            assessment_type: gr.getDisplayValue('assessment_type')
        });
    }

    if (trend.length >= 2) {
        var change = trend[trend.length - 1].score - trend[0].score;
        return { trend: trend, direction: change > 0 ? 'improving' : change < 0 ? 'deteriorating' : 'stable', score_change: change };
    }
    return { trend: trend, direction: 'insufficient_data', score_change: 0 };
}

/**
 * Get vendor assessment findings
 * @param {string} assessmentSysId - Assessment sys_id
 */
function getVendorAssessmentFindings(assessmentSysId) {
    var findings = [];
    var gr = new GlideRecord('sn_vdr_finding');
    gr.addQuery('vendor_assessment', assessmentSysId);
    gr.orderBy('severity');
    gr.query();
    while (gr.next()) {
        findings.push({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            short_description: gr.getValue('short_description'),
            severity: gr.getDisplayValue('severity'),
            category: gr.getDisplayValue('category'),
            state: gr.getDisplayValue('state'),
            remediation_owner: gr.getDisplayValue('remediation_owner'),
            target_remediation_date: gr.getValue('target_remediation_date'),
            remediation_notes: gr.getValue('remediation_notes')
        });
    }
    return findings;
}

/**
 * Get fourth-party (sub-vendor) risks for a primary vendor
 * @param {string} vendorSysId - Primary vendor sys_id
 */
function getFourthPartyRisks(vendorSysId) {
    var subVendors = [];
    var gr = new GlideRecord('sn_vdr_subvendor');
    gr.addQuery('parent_vendor', vendorSysId);
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        subVendors.push({
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            service_provided: gr.getValue('service_provided'),
            data_access: gr.getDisplayValue('data_access'),
            geographic_location: gr.getValue('geographic_location'),
            concentration_risk: gr.getDisplayValue('concentration_risk'),
            exit_strategy: gr.getValue('exit_strategy'),
            last_review_date: gr.getValue('last_review_date')
        });
    }
    return subVendors;
}

// =============================================================================
// SECTION 6: NOTIFICATIONS AND AUTOMATION
// =============================================================================

/**
 * Send reminders for overdue vendor assessments
 */
function sendVendorAssessmentReminders() {
    var count = 0;
    var now = new GlideDateTime();
    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.addQuery('state', 'IN', 'draft,in_progress');
    gr.addQuery('due_date', '<=', now.getValue());
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        try {
            gs.eventQueue('vrm.assessment.overdue', gr, gr.getDisplayValue('vendor'), gr.getValue('due_date'));
            count++;
            gs.info('VRM Reminder: Queued for assessment ' + gr.getValue('number'));
        } catch (e) {
            gs.error('VRM Reminder Error: ' + e.message);
        }
    }
    return count;
}

/**
 * Auto-escalate assessments approaching due date
 * @param {number} warningDays - Days before due date to escalate (default: 7)
 */
function escalateApproachingAssessments(warningDays) {
    var count = 0;
    var now = new GlideDateTime();
    var warningDate = new GlideDateTime();
    warningDate.addDaysLocalTime(warningDays || 7);

    var gr = new GlideRecord('sn_vdr_vendor_assessment');
    gr.addQuery('state', 'IN', 'draft,in_progress');
    gr.addQuery('due_date', '>', now.getValue());
    gr.addQuery('due_date', '<=', warningDate.getValue());
    gr.addQuery('escalated', false);
    gr.addQuery('active', true);
    gr.query();

    while (gr.next()) {
        gs.eventQueue('vrm.assessment.approaching', gr, gr.getDisplayValue('vendor'), gr.getValue('due_date'));
        gr.setValue('escalated', true);
        gr.update();
        count++;
    }
    return count;
}

// =============================================================================
// SECTION 7: VRM UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate vendor risk score based on weighted criteria
 * @param {Object} criteria - Risk criteria with weights
 */
function calculateVendorRiskScore(criteria) {
    var weights = {
        data_sensitivity: 0.25,
        financial_exposure: 0.20,
        operational_dependency: 0.20,
        geographic_risk: 0.10,
        regulatory_compliance: 0.15,
        security_controls: 0.10
    };

    var totalScore = 0;
    var totalWeight = 0;

    Object.keys(weights).forEach(function(key) {
        if (criteria[key] !== undefined && criteria[key] !== null) {
            totalScore += criteria[key] * weights[key];
            totalWeight += weights[key];
        }
    });

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
}

/**
 * Get vendor concentration risk analysis
 * Identifies over-reliance on single vendors for critical services
 */
function getVendorConcentrationRisk() {
    var concentration = {};
    var gr = new GlideRecord('sn_vdr_vendor');
    gr.addQuery('active', true);
    gr.addQuery('criticality_tier', 'tier1');
    gr.query();

    while (gr.next()) {
        var serviceCategory = gr.getValue('service_category') || 'Other';
        if (!concentration[serviceCategory]) concentration[serviceCategory] = [];
        concentration[serviceCategory].push({
            vendor: gr.getValue('name'),
            sys_id: gr.getUniqueValue(),
            risk_rating: gr.getDisplayValue('current_risk_rating'),
            contract_value: gr.getValue('contract_value')
        });
    }

    var risks = [];
    Object.keys(concentration).forEach(function(category) {
        if (concentration[category].length === 1) {
            risks.push({
                category: category,
                risk_level: 'high',
                reason: 'Single vendor dependency',
                vendors: concentration[category]
            });
        }
    });
    return { concentration_map: concentration, concentration_risks: risks };
}
