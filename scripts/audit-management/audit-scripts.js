/**
 * ServiceNow IRM Toolkit - Audit Management Scripts
 * ==================================================
 * GlideRecord scripts for Audit Management module
 * 
 * Author: IRM Toolkit (Based on 20+ Years ServiceNow IRM Experience)
 * Module: sn_audit (Audit Management)
 */

// =============================================================================
// SECTION 1: AUDIT UNIVERSE MANAGEMENT
// =============================================================================

/**
 * Score and prioritize Audit Universe entities using risk-based methodology
 * Based on: Time since last audit + Inherent risk + Open findings + Control failures
 */
function prioritizeAuditUniverse() {
    var entities = [];
    
    var gr = new GlideRecord('sn_audit_audit_universe');
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        var score = 0;
        var factors = {};
        
        // Factor 1: Time since last audit (0-30 points)
        if (gr.last_audited.nil()) {
            score += 30;
            factors.timeFactor = 30;
        } else {
            var daysSince = gs.dateDiff(gr.last_audited + '', gs.nowDateTime(), true);
            if (daysSince > 730) { score += 25; factors.timeFactor = 25; }
            else if (daysSince > 365) { score += 15; factors.timeFactor = 15; }
            else if (daysSince > 180) { score += 10; factors.timeFactor = 10; }
            else { score += 5; factors.timeFactor = 5; }
        }
        
        // Factor 2: Risk rating (0-40 points)
        var riskMap = { 'critical': 40, 'high': 30, 'medium': 20, 'low': 10 };
        var riskFactor = riskMap[gr.risk_rating.toString()] || 20;
        score += riskFactor;
        factors.riskFactor = riskFactor;
        
        // Factor 3: Open findings (5 points each, max 30)
        var openFindings = new GlideAggregate('sn_audit_finding');
        openFindings.addQuery('audit.audit_universe', gr.sys_id);
        openFindings.addQuery('state', '!=', 'closed');
        openFindings.addAggregate('COUNT');
        openFindings.query();
        openFindings.next();
        var findingCount = parseInt(openFindings.getAggregate('COUNT'));
        var findingFactor = Math.min(findingCount * 5, 30);
        score += findingFactor;
        factors.findingFactor = findingFactor;
        
        // Factor 4: Critical findings (10 points each)
        var critFindings = new GlideAggregate('sn_audit_finding');
        critFindings.addQuery('audit.audit_universe', gr.sys_id);
        critFindings.addQuery('severity', 'critical');
        critFindings.addQuery('state', '!=', 'closed');
        critFindings.addAggregate('COUNT');
        critFindings.query();
        critFindings.next();
        var critFactor = parseInt(critFindings.getAggregate('COUNT')) * 10;
        score += critFactor;
        factors.criticalFindingFactor = critFactor;
        
        entities.push({
            sysId: gr.sys_id.toString(),
            name: gr.name.toString(),
            category: gr.category.getDisplayValue(),
            owner: gr.owner.getDisplayValue(),
            lastAudited: gr.last_audited.nil() ? 'Never' : gr.last_audited.toString(),
            riskRating: gr.risk_rating.getDisplayValue(),
            totalScore: score,
            factors: factors,
            openFindingCount: findingCount
        });
    }
    
    // Sort by score (highest first)
    entities.sort(function(a, b) { return b.totalScore - a.totalScore; });
    return entities;
}

/**
 * Generate Risk-Based Annual Audit Plan
 * Takes top N entities from prioritized universe and creates plan
 * @param {string} planYear - e.g., '2026'
 * @param {number} maxAudits - Maximum number of audits in plan
 */
function generateAuditPlan(planYear, maxAudits) {
    maxAudits = maxAudits || 20;
    
    // Get prioritized universe
    var prioritized = prioritizeAuditUniverse();
    
    // Create audit plan record
    var plan = new GlideRecord('sn_audit_plan');
    plan.initialize();
    plan.name = planYear + ' Annual Audit Plan - Risk Based';
    plan.year = planYear;
    plan.state = 'draft';
    plan.description = 'Risk-based audit plan generated automatically from audit universe prioritization on ' + gs.nowDateTime();
    var planSysId = plan.insert();
    
    gs.log('Created audit plan: ' + plan.name + ' (sys_id: ' + planSysId + ')');
    
    // Add top N entities to plan
    var added = 0;
    for (var i = 0; i < Math.min(maxAudits, prioritized.length); i++) {
        var entity = prioritized[i];
        
        var audit = new GlideRecord('sn_audit_audit');
        audit.initialize();
        audit.name = entity.name + ' Audit - ' + planYear;
        audit.plan = planSysId;
        audit.audit_universe = entity.sysId;
        audit.state = 'draft';
        audit.priority = entity.totalScore >= 60 ? 'high' : (entity.totalScore >= 40 ? 'medium' : 'low');
        audit.insert();
        added++;
    }
    
    gs.log('Added ' + added + ' audit engagements to plan');
    return { planSysId: planSysId, auditsAdded: added };
}

// =============================================================================
// SECTION 2: AUDIT ENGAGEMENT MANAGEMENT
// =============================================================================

/**
 * Get Comprehensive Audit Status Report
 */
function getAuditStatusReport(planYear) {
    var report = {
        year: planYear,
        total: 0,
        byState: {},
        overdue: 0,
        findingsSummary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0 }
    };
    
    var states = ['draft', 'planning', 'fieldwork', 'reporting', 'closure', 'closed'];
    
    for (var i = 0; i < states.length; i++) {
        var state = states[i];
        var agg = new GlideAggregate('sn_audit_audit');
        agg.addQuery('plan.year', planYear);
        agg.addQuery('state', state);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        var count = parseInt(agg.getAggregate('COUNT'));
        report.byState[state] = count;
        report.total += count;
    }
    
    // Overdue audits
    var overdue = new GlideAggregate('sn_audit_audit');
    overdue.addQuery('plan.year', planYear);
    overdue.addQuery('state', '!=', 'closed');
    overdue.addQuery('end_date', '<', gs.nowDateTime());
    overdue.addAggregate('COUNT');
    overdue.query();
    overdue.next();
    report.overdue = parseInt(overdue.getAggregate('COUNT'));
    
    // Findings summary
    var severities = ['critical', 'high', 'medium', 'low'];
    for (var j = 0; j < severities.length; j++) {
        var sev = severities[j];
        var findAgg = new GlideAggregate('sn_audit_finding');
        findAgg.addQuery('audit.plan.year', planYear);
        findAgg.addQuery('severity', sev);
        findAgg.addAggregate('COUNT');
        findAgg.query();
        findAgg.next();
        var sevCount = parseInt(findAgg.getAggregate('COUNT'));
        report.findingsSummary[sev] = sevCount;
        report.findingsSummary.total += sevCount;
    }
    
    // Open findings
    var openFinds = new GlideAggregate('sn_audit_finding');
    openFinds.addQuery('audit.plan.year', planYear);
    openFinds.addQuery('state', '!=', 'closed');
    openFinds.addAggregate('COUNT');
    openFinds.query();
    openFinds.next();
    report.findingsSummary.open = parseInt(openFinds.getAggregate('COUNT'));
    
    report.completionRate = report.total > 0 ? 
        Math.round((report.byState.closed / report.total) * 100) : 0;
    
    return report;
}

/**
 * Get Finding Aging Report
 * Categorizes open findings by how long they've been open
 */
function getFindingAgingReport() {
    var aging = {
        current: [],       // 0-30 days
        aging: [],         // 31-60 days  
        overdue: [],       // 61-90 days
        criticalOverdue: [] // 90+ days
    };
    
    var gr = new GlideRecord('sn_audit_finding');
    gr.addQuery('state', 'IN', 'open,in_progress');
    gr.orderBy('due_date');
    gr.query();
    
    while (gr.next()) {
        var daysToDue = gs.dateDiff(gs.nowDateTime(), gr.due_date + '', true);
        var daysNum = parseInt(daysToDue);
        
        var finding = {
            number: gr.number.toString(),
            description: gr.short_description.toString(),
            severity: gr.severity.getDisplayValue(),
            owner: gr.owner.getDisplayValue(),
            audit: gr.audit.getDisplayValue(),
            dueDate: gr.due_date.toString(),
            daysToDue: daysNum
        };
        
        if (daysNum >= 0) {
            aging.current.push(finding);
        } else if (daysNum >= -60) {
            aging.aging.push(finding);
        } else if (daysNum >= -90) {
            aging.overdue.push(finding);
        } else {
            aging.criticalOverdue.push(finding);
        }
    }
    
    gs.log('Finding Aging: Current=' + aging.current.length + 
            ' | Aging=' + aging.aging.length +
            ' | Overdue=' + aging.overdue.length +
            ' | Critical Overdue=' + aging.criticalOverdue.length);
    
    return aging;
}

/**
 * Auto-populate Audit Workpapers from Control Test Results
 * Links existing control failures as audit findings
 * @param {string} auditSysId - sys_id of the audit engagement
 */
function importControlFailuresAsFindings(auditSysId) {
    var audit = new GlideRecord('sn_audit_audit');
    if (!audit.get(auditSysId)) {
        gs.log('Audit not found: ' + auditSysId);
        return 0;
    }
    
    // Find failed control tests for the audit's scope period
    var failedTests = new GlideRecord('sn_compliance_test_result');
    failedTests.addQuery('result', 'fail');
    failedTests.addQuery('tested_on', '>=', audit.start_date);
    failedTests.query();
    
    var importedCount = 0;
    while (failedTests.next()) {
        // Check if finding already exists for this test
        var existing = new GlideRecord('sn_audit_finding');
        existing.addQuery('audit', auditSysId);
        existing.addQuery('source', failedTests.sys_id);
        existing.query();
        
        if (!existing.hasNext()) {
            var finding = new GlideRecord('sn_audit_finding');
            finding.initialize();
            finding.audit = auditSysId;
            finding.short_description = 'Control Test Failure: ' + failedTests.test_plan.control.getDisplayValue();
            finding.description = 'This finding was auto-imported from a failed control test. ' +
                                  'Test Result: ' + failedTests.sys_id + '. ' +
                                  'Tested on: ' + failedTests.tested_on + ' by ' + failedTests.tested_by.getDisplayValue();
            finding.severity = 'medium';
            finding.finding_type = 'observation';
            finding.source = failedTests.sys_id;
            finding.source_table = 'sn_compliance_test_result';
            finding.state = 'open';
            finding.due_date = gs.daysAway(45);
            finding.insert();
            importedCount++;
        }
    }
    
    gs.log('Imported ' + importedCount + ' control failures as audit findings');
    return importedCount;
}

// =============================================================================
// SECTION 3: REPORTING QUERIES
// =============================================================================

/**
 * CAE (Chief Audit Executive) Dashboard Data
 */
function getCAEDashboardData() {
    var currentYear = new Date().getFullYear().toString();
    
    var dashboard = {
        planExecution: getAuditStatusReport(currentYear),
        findingAging: null,
        topIssues: [],
        upcomingAudits: []
    };
    
    // Get top 5 critical/high open findings
    var topFindings = new GlideRecord('sn_audit_finding');
    topFindings.addQuery('state', 'IN', 'open,in_progress');
    topFindings.addQuery('severity', 'IN', 'critical,high');
    topFindings.orderByDesc('severity');
    topFindings.orderBy('due_date');
    topFindings.setLimit(5);
    topFindings.query();
    
    while (topFindings.next()) {
        dashboard.topIssues.push({
            number: topFindings.number.toString(),
            description: topFindings.short_description.toString(),
            severity: topFindings.severity.getDisplayValue(),
            owner: topFindings.owner.getDisplayValue(),
            daysOverdue: parseInt(gs.dateDiff(gs.nowDateTime(), topFindings.due_date + '', true))
        });
    }
    
    // Upcoming audits in next 30 days
    var upcoming = new GlideRecord('sn_audit_audit');
    upcoming.addQuery('state', 'planning');
    upcoming.addQuery('start_date', '<=', gs.daysAway(30));
    upcoming.addQuery('start_date', '>=', gs.nowDateTime());
    upcoming.orderBy('start_date');
    upcoming.query();
    
    while (upcoming.next()) {
        dashboard.upcomingAudits.push({
            number: upcoming.number.toString(),
            name: upcoming.name.toString(),
            startDate: upcoming.start_date.toString(),
            leadAuditor: upcoming.lead_auditor.getDisplayValue()
        });
    }
    
    return dashboard;
}

/**
 * Export Findings to Array (for reports/notifications)
 * @param {string} auditSysId - sys_id of the audit (or null for all)
 */
function exportFindingsToArray(auditSysId) {
    var gr = new GlideRecord('sn_audit_finding');
    
    if (auditSysId) {
        gr.addQuery('audit', auditSysId);
    }
    
    gr.orderByDesc('severity');
    gr.orderBy('due_date');
    gr.query();
    
    var findings = [];
    while (gr.next()) {
        findings.push({
            number: gr.number.toString(),
            auditName: gr.audit.getDisplayValue(),
            description: gr.short_description.toString(),
            severity: gr.severity.getDisplayValue(),
            findingType: gr.finding_type.getDisplayValue(),
            rootCause: gr.root_cause.toString(),
            recommendation: gr.recommendation.toString(),
            managementResponse: gr.management_response.toString(),
            owner: gr.owner.getDisplayValue(),
            dueDate: gr.due_date.toString(),
            state: gr.state.getDisplayValue()
        });
    }
    
    gs.log('Exported ' + findings.length + ' findings');
    return findings;
}

// =============================================================================
// MAIN - Uncomment to test
// =============================================================================

// var priorities = prioritizeAuditUniverse();
// gs.log('Top 10 Priority Entities:');
// for (var i = 0; i < Math.min(10, priorities.length); i++) {
//     gs.log((i+1) + '. ' + priorities[i].name + ' | Score: ' + priorities[i].totalScore);
// }

// var report = getAuditStatusReport(new Date().getFullYear().toString());
// gs.log('Audit Plan Report: ' + JSON.stringify(report, null, 2));

gs.log('Audit Management scripts loaded successfully');
