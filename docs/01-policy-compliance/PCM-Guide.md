# 📋 Policy & Compliance Management (PCM) - Complete Guide

## Overview
Policy & Compliance Management (PCM) is a core ServiceNow IRM module that provides end-to-end management of organizational policies, standards, and controls. It supports mapping to regulatory frameworks (ISO 27001, NIST CSF, SOC 2, GDPR, PCI DSS) through the Unified Compliance Framework (UCF).

---

## Module Components

### 1. Policy Management
Manage the full lifecycle of organizational policies from draft to retirement.

**Key Tables:**
| Table | Label | Key Fields |
|-------|-------|------------|
| sn_compliance_policy | Policy | number, name, state, owner, effective_date, review_date, parent |
| sn_compliance_policy_statement | Policy Statement | policy, statement, control_objective |
| sn_compliance_policy_exception | Policy Exception | policy, reason, approver, expiry_date, state |

**Policy States:**
- Draft → In Review → Awaiting Approval → Published → Under Review → Retired

### 2. Unified Compliance Framework (UCF)
UCF maps your controls to multiple regulatory frameworks simultaneously, eliminating duplicate compliance efforts.

**Key Tables:**
| Table | Label | Key Fields |
|-------|-------|------------|
| sn_compliance_control_objective | Control Objective | name, authority_document, citation, control |
| sn_compliance_authority_document | Authority Document | name, version, type (e.g., ISO 27001) |
| sn_compliance_citation | Citation | authority_document, reference, control_objective |

**Supported Frameworks (UCF Content):**
- ISO 27001:2022
- NIST CSF 2.0
- SOC 2 Type II
- PCI DSS v4.0
- GDPR
- HIPAA
- CIS Controls v8
- COBIT 2019
- ISO 31000

### 3. Control Management
Controls are the safeguards/countermeasures that address control objectives.

**Key Tables:**
| Table | Label | Key Fields |
|-------|-------|------------|
| sn_compliance_control | Control | number, name, type, owner, state, policy, control_objective |
| sn_compliance_control_attestation | Control Attestation | control, attested_by, attestation_date, result |
| sn_compliance_test_plan | Control Test Plan | control, frequency, test_type, owner |
| sn_compliance_test_result | Test Result | test_plan, result, evidence, tested_by, tested_on |

**Control Types:**
- Preventive
- Detective
- Corrective
- Directive
- Compensating

**Control Test Types:**
- Inquiry
- Observation
- Inspection
- Re-performance

### 4. Compliance Monitoring
Continuous compliance posture monitoring through indicators and dashboards.

**Key Tables:**
| Table | Label | Description |
|-------|-------|-------------|
| sn_compliance_aw_indicator | Compliance Indicator | Automated workflow compliance indicators |
| sn_compliance_scope | Compliance Scope | Defines scope of compliance activities |
| sn_compliance_finding | Compliance Finding | Issues found during compliance activities |

---

## PCM Workflows

### Policy Approval Workflow
```
[Policy Created - Draft]
        ↓
[Policy Owner Submits for Review]
        ↓
[Legal/Compliance Team Reviews]
        ↓
[CISO/Executive Approves]
        ↓
[Policy Published]
        ↓
[Notifications sent to all employees]
        ↓
[Attestation Period Opens (30 days)]
        ↓
[Employees Attest]
        ↓
[Non-attestation Follow-ups]
        ↓
[Scheduled Review Date]
        ↓
[Review Cycle Restarts]
```

### Control Test Workflow
```
[Test Plan Created]
        ↓
[Test Due Date Reached]
        ↓
[Control Owner Notified]
        ↓
[Evidence Collection]
        ↓
[Test Performed]
        ↓
[Result: Pass/Fail/Partial]
        ↓
[If Fail → Create Finding]
        ↓
[Finding Assigned for Remediation]
        ↓
[Remediation Tracked to Closure]
```

---

## GlideRecord Scripts

### Query All Published Policies
```javascript
// Get all currently published policies
var gr = new GlideRecord('sn_compliance_policy');
gr.addQuery('state', 'published');
gr.addQuery('active', true);
gr.orderBy('name');
gr.query();

while (gr.next()) {
    gs.log('Policy: ' + gr.name + 
            ' | Owner: ' + gr.owner.getDisplayValue() +
            ' | Review Date: ' + gr.review_date);
}
```

### Find Overdue Policy Reviews
```javascript
// Find policies overdue for review
var gr = new GlideRecord('sn_compliance_policy');
gr.addQuery('state', 'published');
gr.addQuery('review_date', '<', gs.nowDateTime()); // overdue
gr.query();

var count = 0;
while (gr.next()) {
    count++;
    gs.log('OVERDUE REVIEW - Policy: ' + gr.name + 
            ' | Review Date: ' + gr.review_date +
            ' | Owner: ' + gr.owner.getDisplayValue());
}
gs.log('Total overdue policies: ' + count);
```

### Get Control Test Compliance Rate
```javascript
// Calculate control test pass rate
var total = new GlideAggregate('sn_compliance_test_result');
total.addAggregate('COUNT');
total.query();
total.next();
var totalCount = parseInt(total.getAggregate('COUNT'));

var passed = new GlideAggregate('sn_compliance_test_result');
passed.addQuery('result', 'pass');
passed.addAggregate('COUNT');
passed.query();
passed.next();
var passedCount = parseInt(passed.getAggregate('COUNT'));

var rate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
gs.log('Control Test Pass Rate: ' + rate + '% (' + passedCount + '/' + totalCount + ')');
```

### Find Controls Without Test Plans
```javascript
// Controls that have no associated test plans
var gr = new GlideRecord('sn_compliance_control');
gr.addQuery('state', 'active');
gr.query();

while (gr.next()) {
    var testPlan = new GlideRecord('sn_compliance_test_plan');
    testPlan.addQuery('control', gr.sys_id);
    testPlan.query();
    
    if (!testPlan.hasNext()) {
        gs.log('Control without test plan: ' + gr.number + ' - ' + gr.name);
    }
}
```

### Get Policy Attestation Completion Rate
```javascript
// Attestation completion rate per policy
var gr = new GlideRecord('sn_compliance_policy');
gr.addQuery('state', 'published');
gr.query();

while (gr.next()) {
    var total = new GlideAggregate('sn_compliance_attestation');
    total.addQuery('policy', gr.sys_id);
    total.addAggregate('COUNT');
    total.query();
    total.next();
    var totalAttest = parseInt(total.getAggregate('COUNT'));
    
    var completed = new GlideAggregate('sn_compliance_attestation');
    completed.addQuery('policy', gr.sys_id);
    completed.addQuery('state', 'attested');
    completed.addAggregate('COUNT');
    completed.query();
    completed.next();
    var completedAttest = parseInt(completed.getAggregate('COUNT'));
    
    var rate = totalAttest > 0 ? Math.round((completedAttest / totalAttest) * 100) : 0;
    gs.log('Policy: ' + gr.name + ' | Attestation Rate: ' + rate + '%');
}
```

### Find Failed Controls Needing Remediation
```javascript
// Find all failed control tests without open remediation tasks
var gr = new GlideRecord('sn_compliance_test_result');
gr.addQuery('result', 'fail');
gr.addQuery('active', true);
gr.orderByDesc('sys_created_on');
gr.query();

while (gr.next()) {
    gs.log('FAILED CONTROL - Control: ' + gr.test_plan.control.getDisplayValue() +
            ' | Test Date: ' + gr.tested_on +
            ' | Tester: ' + gr.tested_by.getDisplayValue());
}
```

### Map Policies to Frameworks (UCF)
```javascript
// Find all controls mapped to ISO 27001
var gr = new GlideRecord('sn_compliance_control_objective');
gr.addQuery('authority_document.name', 'CONTAINS', 'ISO 27001');
gr.query();

while (gr.next()) {
    gs.log('ISO 27001 Control Objective: ' + gr.name + 
            ' | Reference: ' + gr.citation.reference +
            ' | Mapped Controls: ');
    
    // Get associated controls
    var ctrl = new GlideRecord('sn_compliance_control');
    ctrl.addQuery('control_objective', gr.sys_id);
    ctrl.query();
    while (ctrl.next()) {
        gs.log('  → Control: ' + ctrl.number + ' - ' + ctrl.name);
    }
}
```

### Bulk Create Control Test Plans
```javascript
// Script to create quarterly test plans for all active controls without existing plans
var controls = new GlideRecord('sn_compliance_control');
controls.addQuery('state', 'active');
controls.addQuery('type', 'detective'); // Example: detective controls
controls.query();

var created = 0;
while (controls.next()) {
    // Check if test plan already exists
    var existing = new GlideRecord('sn_compliance_test_plan');
    existing.addQuery('control', controls.sys_id);
    existing.query();
    
    if (!existing.hasNext()) {
        var tp = new GlideRecord('sn_compliance_test_plan');
        tp.control = controls.sys_id;
        tp.name = 'Quarterly Test - ' + controls.name;
        tp.frequency = 'quarterly';
        tp.test_type = 'inspection';
        tp.owner = controls.owner;
        tp.next_test_date = gs.daysAgo(-90); // 90 days from now
        tp.insert();
        created++;
    }
}
gs.log('Created ' + created + ' new test plans');
```

---

## Encoded Queries for Reports

### All High-Risk Controls (GRC Portal Query)
```
state=active^risk_rating=high^ORrisk_rating=critical
```

### Compliance Dashboard - Failed Tests This Quarter
```
result=fail^tested_onONThis quarter@javascript:gs.beginningOfThisQuarter()@javascript:gs.endOfThisQuarter()
```

### Policies Due for Review in Next 30 Days
```
state=published^review_dateBETWEENjavascript:gs.beginningOfToday()@javascript:gs.daysAway(30)
```

### Open Exceptions by Approver
```
state=open^ORstate=pending_approval^approverISNOTEMPTY
```

---

## Business Rules

### Auto-notify Policy Owner on Review Date
```javascript
// Business Rule: Before Query on sn_compliance_policy
// Condition: active=true

(function executeRule(current, previous /*null when async*/) {
    
    // Send notification when review date is within 30 days
    var reviewDate = new GlideDateTime(current.review_date);
    var thirtyDaysFromNow = new GlideDateTime();
    thirtyDaysFromNow.addDaysUTC(30);
    
    if (reviewDate.before(thirtyDaysFromNow)) {
        gs.eventQueue('policy.review.due', current, current.owner, current.review_date);
    }
    
})(current, previous);
```

### Auto-create Finding on Control Test Failure
```javascript
// Business Rule: After Insert on sn_compliance_test_result
// Condition: result=fail

(function executeRule(current, previous) {
    
    var finding = new GlideRecord('sn_compliance_finding');
    finding.initialize();
    finding.short_description = 'Control Test Failed: ' + current.test_plan.control.getDisplayValue();
    finding.description = 'Automated finding created from failed control test. Test Result: ' + current.sys_id;
    finding.control = current.test_plan.control;
    finding.source = current.sys_id;
    finding.source_table = 'sn_compliance_test_result';
    finding.state = 'open';
    finding.severity = 'high';
    finding.assigned_to = current.test_plan.owner;
    finding.insert();
    
    gs.log('Auto-created finding for failed control test: ' + finding.number);
    
})(current, previous);
```

---

## Scheduled Jobs

### Weekly Policy Compliance Report
```javascript
// Scheduled Script: Runs every Monday at 8 AM
// Name: Weekly_Policy_Compliance_Report

var report = [];

// Get compliance posture
var total = new GlideAggregate('sn_compliance_control');
total.addQuery('active', true);
total.addAggregate('COUNT');
total.query();
total.next();
var totalControls = parseInt(total.getAggregate('COUNT'));

var testedThisQuarter = new GlideAggregate('sn_compliance_test_result');
testedThisQuarter.addQuery('tested_on', '>=', gs.beginningOfThisQuarter());
testedThisQuarter.addAggregate('COUNT', 'control');
testedThisQuarter.query();

var uniqueTested = 0;
while (testedThisQuarter.next()) { uniqueTested++; }

var coverage = Math.round((uniqueTested / totalControls) * 100);

gs.log('=== WEEKLY COMPLIANCE REPORT ===');
gs.log('Total Active Controls: ' + totalControls);
gs.log('Controls Tested This Quarter: ' + uniqueTested);
gs.log('Test Coverage: ' + coverage + '%');

// Get pass/fail stats
var passed = new GlideAggregate('sn_compliance_test_result');
passed.addQuery('tested_on', '>=', gs.beginningOfThisQuarter());
passed.addQuery('result', 'pass');
passed.addAggregate('COUNT');
passed.query();
passed.next();
var passCount = parseInt(passed.getAggregate('COUNT'));

var failed = new GlideAggregate('sn_compliance_test_result');
failed.addQuery('tested_on', '>=', gs.beginningOfThisQuarter());
failed.addQuery('result', 'fail');
failed.addAggregate('COUNT');
failed.query();
failed.next();
var failCount = parseInt(failed.getAggregate('COUNT'));

gs.log('Pass Rate: ' + (passCount + failCount > 0 ? Math.round(passCount/(passCount+failCount)*100) : 0) + '%');
gs.log('=================================');
```

---

## Integration Points

### Connect PCM to Risk Management
Controls in PCM are linked to Risks via the M2M table `sn_risk_m2m_risk_control`. When a control fails, associated risks should be reassessed.

```javascript
// Find risks impacted by a failed control
function getRisksForControl(controlSysId) {
    var risks = [];
    var m2m = new GlideRecord('sn_risk_m2m_risk_control');
    m2m.addQuery('control', controlSysId);
    m2m.query();
    
    while (m2m.next()) {
        risks.push({
            riskId: m2m.risk.sys_id,
            riskNumber: m2m.risk.number + '',
            riskName: m2m.risk.name + '',
            currentRating: m2m.risk.residual_score + ''
        });
    }
    return risks;
}
```

---

## Key Performance Indicators (KPIs)

| KPI | Formula | Target |
|-----|---------|--------|
| Policy Coverage | Published Policies / Total Policies × 100 | 100% |
| Attestation Rate | Attested / Required Attestations × 100 | ≥95% |
| Control Test Coverage | Controls Tested / Total Controls × 100 | ≥90% |
| Control Test Pass Rate | Passed Tests / Total Tests × 100 | ≥85% |
| Exception Rate | Open Exceptions / Total Controls × 100 | ≤5% |
| Overdue Reviews | Policies Overdue / Total Policies × 100 | 0% |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
