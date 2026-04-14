/**
 * ServiceNow IRM Toolkit - Policy & Compliance Scripts
 * =====================================================
 * GlideRecord scripts for Policy & Compliance Management module
 * 
 * Author: IRM Toolkit (Based on 20+ Years ServiceNow IRM Experience)
 * Module: sn_compliance (Policy & Compliance Management)
 */

// =============================================================================
// SECTION 1: POLICY MANAGEMENT
// =============================================================================

/**
 * Get Policy Compliance Summary
 * Returns overall compliance posture metrics
 */
function getPolicyComplianceSummary() {
    var summary = {
        policies: { total: 0, published: 0, draft: 0, underReview: 0, overdue: 0 },
        controls: { total: 0, active: 0, noTestPlan: 0 },
        tests: { total: 0, passed: 0, failed: 0, passRate: 0 },
        exceptions: { open: 0, expired: 0 },
        attestations: { pending: 0, completed: 0, rate: 0 }
    };
    
    // Policy counts
    var policyStates = [
        { state: 'published', field: 'published' },
        { state: 'draft', field: 'draft' },
        { state: 'under_review', field: 'underReview' }
    ];
    
    for (var i = 0; i < policyStates.length; i++) {
        var agg = new GlideAggregate('sn_compliance_policy');
        agg.addQuery('state', policyStates[i].state);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        var count = parseInt(agg.getAggregate('COUNT'));
        summary.policies[policyStates[i].field] = count;
        summary.policies.total += count;
    }
    
    // Overdue reviews
    var overdue = new GlideAggregate('sn_compliance_policy');
    overdue.addQuery('state', 'published');
    overdue.addQuery('review_date', '<', gs.nowDateTime());
    overdue.addAggregate('COUNT');
    overdue.query();
    overdue.next();
    summary.policies.overdue = parseInt(overdue.getAggregate('COUNT'));
    
    // Control counts
    var totalControls = new GlideAggregate('sn_compliance_control');
    totalControls.addQuery('active', true);
    totalControls.addAggregate('COUNT');
    totalControls.query();
    totalControls.next();
    summary.controls.total = parseInt(totalControls.getAggregate('COUNT'));
    
    // Test pass/fail rates
    var passed = new GlideAggregate('sn_compliance_test_result');
    passed.addQuery('result', 'pass');
    passed.addAggregate('COUNT');
    passed.query();
    passed.next();
    summary.tests.passed = parseInt(passed.getAggregate('COUNT'));
    
    var failed = new GlideAggregate('sn_compliance_test_result');
    failed.addQuery('result', 'fail');
    failed.addAggregate('COUNT');
    failed.query();
    failed.next();
    summary.tests.failed = parseInt(failed.getAggregate('COUNT'));
    
    summary.tests.total = summary.tests.passed + summary.tests.failed;
    summary.tests.passRate = summary.tests.total > 0 ? 
        Math.round((summary.tests.passed / summary.tests.total) * 100) : 0;
    
    return summary;
}

/**
 * Get Policies Due for Review (within next N days)
 * @param {number} daysAhead - Days to look ahead
 */
function getPoliciesDueForReview(daysAhead) {
    daysAhead = daysAhead || 30;
    
    var gr = new GlideRecord('sn_compliance_policy');
    gr.addQuery('state', 'published');
    gr.addQuery('review_date', '<=', gs.daysAway(daysAhead));
    gr.orderBy('review_date');
    gr.query();
    
    var policies = [];
    while (gr.next()) {
        var daysToReview = gs.dateDiff(gs.nowDateTime(), gr.review_date + '', true);
        policies.push({
            number: gr.number.toString(),
            name: gr.name.toString(),
            owner: gr.owner.getDisplayValue(),
            reviewDate: gr.review_date.toString(),
            daysToReview: parseInt(daysToReview),
            isOverdue: parseInt(daysToReview) < 0
        });
    }
    
    return policies;
}

/**
 * Get Policy Attestation Status
 * @param {string} policySysId - sys_id of the policy
 */
function getPolicyAttestationStatus(policySysId) {
    var status = {
        policyName: '',
        totalRequired: 0,
        completed: 0,
        pending: 0,
        declined: 0,
        completionRate: 0
    };
    
    var policy = new GlideRecord('sn_compliance_policy');
    if (policy.get(policySysId)) {
        status.policyName = policy.name.toString();
    }
    
    var total = new GlideAggregate('sn_compliance_attestation');
    total.addQuery('policy', policySysId);
    total.addAggregate('COUNT');
    total.query();
    total.next();
    status.totalRequired = parseInt(total.getAggregate('COUNT'));
    
    var attestStates = [
        { state: 'attested', field: 'completed' },
        { state: 'pending', field: 'pending' },
        { state: 'declined', field: 'declined' }
    ];
    
    for (var i = 0; i < attestStates.length; i++) {
        var agg = new GlideAggregate('sn_compliance_attestation');
        agg.addQuery('policy', policySysId);
        agg.addQuery('state', attestStates[i].state);
        agg.addAggregate('COUNT');
        agg.query();
        agg.next();
        status[attestStates[i].field] = parseInt(agg.getAggregate('COUNT'));
    }
    
    status.completionRate = status.totalRequired > 0 ? 
        Math.round((status.completed / status.totalRequired) * 100) : 0;
    
    return status;
}

// =============================================================================
// SECTION 2: CONTROL MANAGEMENT
// =============================================================================

/**
 * Find Controls Without Test Plans
 */
function findControlsWithoutTestPlans() {
    var gr = new GlideRecord('sn_compliance_control');
    gr.addQuery('active', true);
    gr.addQuery('state', '!=', 'retired');
    gr.query();
    
    var noTestPlan = [];
    while (gr.next()) {
        var testPlan = new GlideRecord('sn_compliance_test_plan');
        testPlan.addQuery('control', gr.sys_id);
        testPlan.addQuery('active', true);
        testPlan.setLimit(1);
        testPlan.query();
        
        if (!testPlan.hasNext()) {
            noTestPlan.push({
                number: gr.number.toString(),
                name: gr.name.toString(),
                type: gr.type.getDisplayValue(),
                owner: gr.owner.getDisplayValue(),
                policy: gr.policy.getDisplayValue()
            });
        }
    }
    
    return noTestPlan;
}

/**
 * Get Control Test Results by Framework
 * @param {string} frameworkName - e.g., 'ISO 27001', 'SOC 2', 'PCI DSS'
 */
function getControlTestResultsByFramework(frameworkName) {
    var results = { passed: 0, failed: 0, notTested: 0, passRate: 0 };
    
    // Get all control objectives for this framework
    var objectives = new GlideRecord('sn_compliance_control_objective');
    objectives.addQuery('authority_document.name', 'CONTAINS', frameworkName);
    objectives.query();
    
    while (objectives.next()) {
        // Get controls for each objective
        var controls = new GlideRecord('sn_compliance_control');
        controls.addQuery('control_objective', objectives.sys_id);
        controls.addQuery('active', true);
        controls.query();
        
        while (controls.next()) {
            // Get latest test result
            var testResult = new GlideRecord('sn_compliance_test_result');
            testResult.addQuery('test_plan.control', controls.sys_id);
            testResult.orderByDesc('sys_created_on');
            testResult.setLimit(1);
            testResult.query();
            
            if (testResult.next()) {
                if (testResult.result == 'pass') results.passed++;
                else if (testResult.result == 'fail') results.failed++;
            } else {
                results.notTested++;
            }
        }
    }
    
    var totalTested = results.passed + results.failed;
    results.passRate = totalTested > 0 ? Math.round((results.passed / totalTested) * 100) : 0;
    
    gs.log(frameworkName + ' Results: Passed=' + results.passed + 
            ' Failed=' + results.failed + ' Untested=' + results.notTested +
            ' Pass Rate=' + results.passRate + '%');
    
    return results;
}

/**
 * Get Open Compliance Exceptions
 */
function getOpenExceptions() {
    var gr = new GlideRecord('sn_compliance_exception');
    gr.addQuery('state', 'IN', 'open,pending_approval,approved');
    gr.orderBy('expiry_date');
    gr.query();
    
    var exceptions = [];
    while (gr.next()) {
        var daysToExpiry = gs.dateDiff(gs.nowDateTime(), gr.expiry_date + '', true);
        exceptions.push({
            number: gr.number.toString(),
            name: gr.name.toString(),
            control: gr.control.getDisplayValue(),
            policy: gr.policy.getDisplayValue(),
            reason: gr.reason.toString(),
            approver: gr.approver.getDisplayValue(),
            expiryDate: gr.expiry_date.toString(),
            daysToExpiry: parseInt(daysToExpiry),
            state: gr.state.getDisplayValue(),
            risk: gr.risk.getDisplayValue()
        });
    }
    
    return exceptions;
}

/**
 * Create Control Exception with Approval Workflow
 * @param {object} exceptionData - Exception details
 */
function createControlException(exceptionData) {
    var exception = new GlideRecord('sn_compliance_exception');
    exception.initialize();
    
    exception.name = exceptionData.name;
    exception.reason = exceptionData.reason;
    exception.control = exceptionData.controlSysId;
    exception.policy = exceptionData.policySysId;
    exception.requested_by = gs.getUserID();
    exception.approver = exceptionData.approverSysId;
    exception.expiry_date = exceptionData.expiryDate;
    exception.compensating_control = exceptionData.compensatingControl || '';
    exception.risk = exceptionData.riskLevel || 'medium';
    exception.state = 'pending_approval';
    
    var sysId = exception.insert();
    
    // Trigger approval workflow
    gs.eventQueue('sn_compliance.exception.created', exception, exception.approver, '');
    
    gs.log('Control exception created: ' + exception.number);
    return sysId;
}

// =============================================================================
// SECTION 3: UCF / FRAMEWORK MAPPING
// =============================================================================

/**
 * Get Control Coverage by Regulatory Framework
 * Shows how many framework requirements have mapped controls
 */
function getFrameworkCoverage() {
    var frameworks = [];
    
    var authDocs = new GlideRecord('sn_compliance_authority_document');
    authDocs.addQuery('active', true);
    authDocs.query();
    
    while (authDocs.next()) {
        var totalObjectives = new GlideAggregate('sn_compliance_control_objective');
        totalObjectives.addQuery('authority_document', authDocs.sys_id);
        totalObjectives.addAggregate('COUNT');
        totalObjectives.query();
        totalObjectives.next();
        var total = parseInt(totalObjectives.getAggregate('COUNT'));
        
        // Count objectives with mapped controls
        var mapped = 0;
        var objectives = new GlideRecord('sn_compliance_control_objective');
        objectives.addQuery('authority_document', authDocs.sys_id);
        objectives.query();
        
        while (objectives.next()) {
            var ctrl = new GlideRecord('sn_compliance_control');
            ctrl.addQuery('control_objective', objectives.sys_id);
            ctrl.addQuery('active', true);
            ctrl.setLimit(1);
            ctrl.query();
            if (ctrl.hasNext()) mapped++;
        }
        
        if (total > 0) {
            frameworks.push({
                name: authDocs.name.toString(),
                totalRequirements: total,
                mappedControls: mapped,
                coverageRate: Math.round((mapped / total) * 100)
            });
        }
    }
    
    // Sort by coverage rate
    frameworks.sort(function(a, b) { return b.coverageRate - a.coverageRate; });
    return frameworks;
}

// =============================================================================
// SECTION 4: COMPLIANCE REPORTING
// =============================================================================

/**
 * Generate SOC 2 Compliance Report Data
 * Maps ServiceNow controls to SOC 2 Trust Service Criteria
 */
function generateSOC2Report() {
    var trustCriteria = {
        'CC': 'Common Criteria (Security)',
        'A': 'Availability',
        'C': 'Confidentiality',
        'PI': 'Processing Integrity',
        'P': 'Privacy'
    };
    
    var report = {};
    
    for (var prefix in trustCriteria) {
        var category = trustCriteria[prefix];
        
        // Get objectives for this SOC 2 category
        var objectives = new GlideRecord('sn_compliance_control_objective');
        objectives.addQuery('authority_document.name', 'CONTAINS', 'SOC 2');
        objectives.addQuery('name', 'STARTSWITH', prefix);
        objectives.query();
        
        var controls = { total: 0, passing: 0, failing: 0, notTested: 0 };
        
        while (objectives.next()) {
            var ctrl = new GlideRecord('sn_compliance_control');
            ctrl.addQuery('control_objective', objectives.sys_id);
            ctrl.query();
            
            while (ctrl.next()) {
                controls.total++;
                
                var result = new GlideRecord('sn_compliance_test_result');
                result.addQuery('test_plan.control', ctrl.sys_id);
                result.orderByDesc('sys_created_on');
                result.setLimit(1);
                result.query();
                
                if (result.next()) {
                    if (result.result == 'pass') controls.passing++;
                    else controls.failing++;
                } else {
                    controls.notTested++;
                }
            }
        }
        
        report[category] = controls;
    }
    
    return report;
}

// =============================================================================
// MAIN - Uncomment to test
// =============================================================================

// var summary = getPolicyComplianceSummary();
// gs.log('Compliance Summary: ' + JSON.stringify(summary, null, 2));

// var frameworks = getFrameworkCoverage();
// gs.log('Framework Coverage: ' + JSON.stringify(frameworks, null, 2));

// var exceptions = getOpenExceptions();
// gs.log('Open Exceptions: ' + exceptions.length);

gs.log('Policy & Compliance scripts loaded successfully');
