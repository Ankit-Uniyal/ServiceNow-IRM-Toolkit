# ServiceNow IRM - Policy & Compliance Workflow Templates

> **Module:** Policy & Compliance Management (PCM) | **Version:** 2.0 | **Author:** Ankit Uniyal

## Overview

Flow Designer and Workflow templates for automating Policy & Compliance Management processes in ServiceNow IRM.

---

## 1. Policy Lifecycle Workflow

### Flow: Policy Creation and Approval
```
Trigger: Record Created on [sn_compliance_policy] where state = 'draft'
Actions:
  1. Assign Policy ID/Number
  2. Set Policy Owner and Reviewer
  3. Set review cycle (annual by default)
  4. Route to Policy Owner for content completion
  5. On Content Complete:
     a. Route to Legal/Compliance for review (5 business days)
     b. Route to CISO/Executive for approval
  6. On Approval:
     a. Set state = 'published'
     b. Set effective date
     c. Set next review date = Today + 365 days
     d. Trigger attestation workflow for affected users
  7. Send publication notification to all stakeholders
```

### Policy Approval Script:
```javascript
// Publish policy and initiate attestation
function publishPolicy(policySysId) {
    var policyGr = new GlideRecord('sn_compliance_policy');
    if (!policyGr.get(policySysId)) return false;
    
    policyGr.setValue('state', 'published');
    policyGr.setValue('published_date', new GlideDateTime());
    policyGr.setValue('published_by', gs.getUserID());
    
    var nextReview = new GlideDateTime();
    nextReview.addMonthsLocalTime(12);
    policyGr.setValue('next_review_date', nextReview.getValue());
    policyGr.setValue('version', policyGr.getValue('version') || '1.0');
    policyGr.update();
    
    // Trigger attestation for affected user groups
    var groups = policyGr.getValue('applicable_groups');
    if (groups) {
        gs.eventQueue('sn_compliance.policy.published', policyGr, groups, policySysId);
    }
    
    gs.info('Policy published: ' + policyGr.getValue('number') + ' v' + policyGr.getValue('version'));
    return true;
}
```

---

## 2. Policy Attestation Workflow

### Flow: Annual Policy Attestation Campaign
```
Trigger: Policy state changes to 'published' OR Scheduled (annual review date)
Actions:
  1. Create Attestation Campaign record
  2. Identify all users/groups required to attest
  3. Send attestation request emails with policy links
  4. Set attestation deadline = Today + 30 days
  5. Send reminders at: 14 days, 7 days, 3 days, 1 day before deadline
  6. On each attestation submission:
     a. Record attestation with timestamp and user
     b. Update campaign completion percentage
  7. On deadline:
     a. Mark non-attestors as 'non-compliant'
     b. Escalate to their managers
     c. Generate attestation completion report
```

### Attestation Campaign Manager:
```javascript
// Create and manage attestation campaign
var AttestationCampaign = {
    create: function(policySysId, deadlineDays) {
        var policyGr = new GlideRecord('sn_compliance_policy');
        if (!policyGr.get(policySysId)) return null;
        
        var campGr = new GlideRecord('sn_compliance_attestation');
        campGr.initialize();
        campGr.setValue('policy', policySysId);
        campGr.setValue('name', 'Attestation: ' + policyGr.getValue('name') + ' - ' + new GlideDateTime().getYearLocalTime());
        campGr.setValue('state', 'active');
        
        var deadline = new GlideDateTime();
        deadline.addDaysLocalTime(deadlineDays || 30);
        campGr.setValue('due_date', deadline.getValue());
        campGr.setValue('initiated_by', gs.getUserID());
        
        var campSysId = campGr.insert();
        
        // Create individual attestation records
        var count = this.createAttestationRecords(campSysId, policySysId, policyGr.getValue('applicable_groups'));
        gs.info('Attestation campaign created: ' + count + ' attestations for policy ' + policyGr.getValue('number'));
        return { campaign_sys_id: campSysId, attestation_count: count };
    },
    
    createAttestationRecords: function(campaignSysId, policySysId, groupList) {
        var count = 0;
        if (!groupList) return count;
        
        var groups = groupList.split(',');
        groups.forEach(function(groupSysId) {
            groupSysId = groupSysId.trim();
            var memberGr = new GlideRecord('sys_user_grmember');
            memberGr.addQuery('group', groupSysId);
            memberGr.query();
            while (memberGr.next()) {
                var attestGr = new GlideRecord('sn_compliance_attestation_record');
                attestGr.initialize();
                attestGr.setValue('attestation_campaign', campaignSysId);
                attestGr.setValue('policy', policySysId);
                attestGr.setValue('user', memberGr.getValue('user'));
                attestGr.setValue('state', 'pending');
                attestGr.insert();
                count++;
            }
        });
        return count;
    },
    
    getCompletionRate: function(campaignSysId) {
        var total = 0; var completed = 0;
        var gr = new GlideRecord('sn_compliance_attestation_record');
        gr.addQuery('attestation_campaign', campaignSysId);
        gr.query();
        while (gr.next()) {
            total++;
            if (gr.getValue('state') === 'attested') completed++;
        }
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    }
};
```

---

## 3. Control Testing Workflow

### Flow: Quarterly Control Testing Program
```
Trigger: Scheduled - First day of each quarter
Actions:
  1. Identify all controls due for testing this quarter
  2. Create Test Plans for each control
  3. Assign tests to control testers
  4. Send testing assignments with instructions
  5. On Test Execution:
     a. Collect evidence uploads
     b. Record test results (effective/ineffective/not_tested)
     c. Calculate control effectiveness score
  6. On Ineffective Test Result:
     a. Create Remediation Task
     b. Notify Control Owner
     c. Update compliance posture
  7. Generate quarterly control testing report
```

### Control Test Execution Script:
```javascript
// Record control test result and update effectiveness
function recordControlTestResult(testPlanSysId, result, evidence, notes) {
    var testGr = new GlideRecord('sn_compliance_test_plan');
    if (!testGr.get(testPlanSysId)) return false;
    
    var testResultGr = new GlideRecord('sn_compliance_test_result');
    testResultGr.initialize();
    testResultGr.setValue('test_plan', testPlanSysId);
    testResultGr.setValue('control', testGr.getValue('control'));
    testResultGr.setValue('result', result);
    testResultGr.setValue('notes', notes || '');
    testResultGr.setValue('tested_by', gs.getUserID());
    testResultGr.setValue('test_date', new GlideDateTime());
    testResultGr.insert();
    
    // Update test plan state
    testGr.setValue('state', result === 'effective' ? 'completed_effective' : 
                              result === 'ineffective' ? 'completed_ineffective' : 'completed');
    testGr.setValue('last_tested', new GlideDateTime());
    testGr.setValue('last_result', result);
    testGr.update();
    
    // Update control effectiveness
    var controlGr = new GlideRecord('sn_compliance_control');
    if (controlGr.get(testGr.getValue('control'))) {
        var effectiveness = result === 'effective' ? 'effective' :
                           result === 'partially_effective' ? 'partially_effective' : 'ineffective';
        controlGr.setValue('effectiveness', effectiveness);
        controlGr.setValue('state', result === 'effective' ? 'compliant' : 'non_compliant');
        controlGr.update();
    }
    
    // Create remediation task if ineffective
    if (result === 'ineffective') {
        var remGr = new GlideRecord('sn_compliance_remediation_task');
        remGr.initialize();
        remGr.setValue('control', testGr.getValue('control'));
        remGr.setValue('test_result', testResultGr.getUniqueValue());
        remGr.setValue('short_description', 'Remediate: ' + controlGr.getValue('name'));
        remGr.setValue('state', 'open');
        
        var dueDate = new GlideDateTime();
        dueDate.addDaysLocalTime(30);
        remGr.setValue('due_date', dueDate.getValue());
        remGr.insert();
        
        gs.eventQueue('sn_compliance.control.ineffective', testResultGr, controlGr.getValue('name'), '');
    }
    
    return true;
}
```

---

## 4. Exception Management Workflow

### Flow: Compliance Exception Request
```
Trigger: Record Created on [sn_compliance_exception]
Actions:
  1. Auto-number exception
  2. Validate exception request completeness
  3. Route to Control Owner for initial review (3 days)
  4. Route to Risk Manager for risk acceptance review (5 days)
  5. Route to CISO for approval if risk = high/critical
  6. On Approval:
     a. Set state = 'approved'
     b. Set expiration date
     c. Schedule expiration reminder
     d. Update control status
  7. On Rejection:
     a. Notify requestor with reason
     b. Create mandatory remediation plan
  8. Monitor and expire automatically on expiration date
```

### Exception Expiration Monitor:
```javascript
// Scheduled script - check for expiring exceptions
function monitorExceptionExpirations() {
    var now = new GlideDateTime();
    var d30 = new GlideDateTime(); d30.addDaysLocalTime(30);
    var d7 = new GlideDateTime(); d7.addDaysLocalTime(7);
    
    var gr = new GlideRecord('sn_compliance_exception');
    gr.addQuery('state', 'approved');
    gr.addQuery('active', true);
    gr.query();
    
    var expired = 0; var expiring30 = 0; var expiring7 = 0;
    
    while (gr.next()) {
        var expDate = gr.getGlideObject('expiration_date');
        if (!expDate) continue;
        
        if (expDate.compareTo(now) < 0) {
            // Expired - auto-close
            gr.setValue('state', 'expired');
            gr.setValue('active', false);
            gr.update();
            
            // Reopen associated control as non-compliant
            var ctrlGr = new GlideRecord('sn_compliance_control');
            if (ctrlGr.get(gr.getValue('control'))) {
                ctrlGr.setValue('state', 'non_compliant');
                ctrlGr.update();
            }
            expired++;
            
        } else if (expDate.compareTo(d7) < 0) {
            gs.eventQueue('sn_compliance.exception.expiring', gr, '7', gr.getValue('expiration_date'));
            expiring7++;
        } else if (expDate.compareTo(d30) < 0) {
            gs.eventQueue('sn_compliance.exception.expiring', gr, '30', gr.getValue('expiration_date'));
            expiring30++;
        }
    }
    
    gs.info('Exception Monitor: Expired=' + expired + ', Expiring(7d)=' + expiring7 + ', Expiring(30d)=' + expiring30);
    return { expired: expired, expiring_7_days: expiring7, expiring_30_days: expiring30 };
}
```

---

## 5. UCF Control Mapping Workflow

### Flow: New Regulatory Requirement Mapping
```
Trigger: New UCF Control Objective added or regulatory update
Actions:
  1. Identify impacted existing controls
  2. Create gap analysis tasks
  3. Map existing controls to new requirements
  4. Identify gaps where controls are missing
  5. Create new control records for gaps
  6. Assign control owners
  7. Set implementation deadlines
  8. Notify relevant stakeholders
  9. Update compliance coverage metrics
```

---

## 6. Policy Review Workflow

### Scheduled Flow: Annual Policy Review
```
Trigger: Scheduled - 60 days before policy next_review_date
Actions:
  1. Create Policy Review task for Policy Owner
  2. Send advance notification to Policy Owner
  3. Pull any regulatory changes since last review
  4. At 30 days: Send reminder with review checklist
  5. At 14 days: Escalate if review not started
  6. On Review Completion:
     a. If no changes: Confirm policy current, update review date
     b. If changes needed: Route through full approval workflow
  7. On Expiry without review: Mark policy as 'overdue_review'
```

---

## 7. Compliance Scorecard Workflow

### Scheduled Flow: Monthly Compliance Scorecard Generation
```
Trigger: Scheduled - Last business day of each month
Actions:
  1. Calculate compliance scores by framework
  2. Calculate control effectiveness rates
  3. Count open exceptions, overdue tests
  4. Compare to previous month (trend analysis)
  5. Generate PDF scorecard report
  6. Email to: CISO, Compliance Manager, Risk Manager, Board (quarterly)
  7. Update dashboard KPI widgets
  8. Archive monthly report
```

### Compliance Score Calculation Script:
```javascript
// Monthly compliance scorecard generator
function generateComplianceScorecard() {
    var scorecard = {
        generated_date: new GlideDateTime().getDisplayValue(),
        period: 'Monthly',
        overall_score: 0,
        by_framework: [],
        control_effectiveness: { effective: 0, partially_effective: 0, ineffective: 0, not_tested: 0 },
        exceptions: { active: 0, expiring_soon: 0, expired: 0 },
        overdue_tests: 0
    };
    
    // Compliance by framework
    var frameworks = ['ISO 27001', 'SOC 2', 'GDPR', 'PCI-DSS', 'NIST CSF', 'HIPAA'];
    var overallTotal = 0; var overallCompliant = 0;
    
    frameworks.forEach(function(fw) {
        var ga = new GlideAggregate('sn_compliance_control');
        ga.addQuery('active', true);
        ga.addQuery('framework.name', fw);
        ga.groupBy('state');
        ga.addAggregate('COUNT');
        ga.query();
        
        var total = 0; var compliant = 0;
        while (ga.next()) {
            var cnt = parseInt(ga.getAggregate('COUNT'));
            total += cnt;
            if (ga.getValue('state') === 'compliant' || ga.getValue('state') === 'effective') compliant += cnt;
        }
        
        if (total > 0) {
            scorecard.by_framework.push({
                framework: fw,
                total: total,
                compliant: compliant,
                score: Math.round((compliant / total) * 100)
            });
            overallTotal += total;
            overallCompliant += compliant;
        }
    });
    
    scorecard.overall_score = overallTotal > 0 ? Math.round((overallCompliant / overallTotal) * 100) : 0;
    
    // Control effectiveness breakdown
    var effectGr = new GlideAggregate('sn_compliance_control');
    effectGr.addQuery('active', true);
    effectGr.groupBy('effectiveness');
    effectGr.addAggregate('COUNT');
    effectGr.query();
    while (effectGr.next()) {
        var eff = effectGr.getValue('effectiveness') || 'not_tested';
        var cnt = parseInt(effectGr.getAggregate('COUNT'));
        if (scorecard.control_effectiveness[eff] !== undefined) scorecard.control_effectiveness[eff] = cnt;
    }
    
    return scorecard;
}
```

---

## Business Rule Templates for Compliance Module

### BR-001: Auto-Set Control Test Frequency
```javascript
// Business Rule: sn_compliance_control | Before | Insert
// Set test frequency based on control criticality
var frequencyMap = { critical: 'monthly', high: 'quarterly', medium: 'semi_annual', low: 'annual' };
var criticality = current.criticality.getValue() || 'medium';
current.test_frequency = frequencyMap[criticality] || 'quarterly';

// Set next test date
var nextTest = new GlideDateTime();
var testMonths = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
nextTest.addMonthsLocalTime(testMonths[current.test_frequency.getValue()] || 3);
current.next_test_date = nextTest.getValue();
```

### BR-002: Escalate Non-Compliant Controls
```javascript
// Business Rule: sn_compliance_control | After | Update
// Condition: current.state.changesTo('non_compliant')
if (current.state.changesTo('non_compliant')) {
    gs.eventQueue('sn_compliance.control.noncompliant', current, 
                  current.getDisplayValue('framework'), 
                  current.getDisplayValue('owned_by'));
    
    // Create remediation task
    var taskGr = new GlideRecord('sn_compliance_remediation_task');
    taskGr.initialize();
    taskGr.setValue('control', current.getUniqueValue());
    taskGr.setValue('short_description', 'Remediate non-compliant control: ' + current.getValue('name'));
    taskGr.setValue('assigned_to', current.getValue('owned_by'));
    taskGr.setValue('state', 'open');
    var due = new GlideDateTime();
    due.addDaysLocalTime(30);
    taskGr.setValue('due_date', due.getValue());
    taskGr.insert();
}
```

### BR-003: Track Policy Version History
```javascript
// Business Rule: sn_compliance_policy | Before | Update
// Condition: current.state.changesTo('published')
if (current.state.changesTo('published')) {
    // Archive previous version
    var histGr = new GlideRecord('sn_compliance_policy_version');
    histGr.initialize();
    histGr.setValue('policy', current.getUniqueValue());
    histGr.setValue('version', previous.getValue('version'));
    histGr.setValue('content', previous.getValue('content'));
    histGr.setValue('published_date', previous.getValue('published_date'));
    histGr.setValue('retired_date', new GlideDateTime());
    histGr.insert();
    
    // Increment version number
    var versionParts = (current.getValue('version') || '1.0').split('.');
    versionParts[1] = String(parseInt(versionParts[1] || '0') + 1);
    current.version = versionParts.join('.');
}
```

---

*ServiceNow IRM Toolkit - Compliance Workflow Templates | Version 2.0 | Ankit Uniyal*
