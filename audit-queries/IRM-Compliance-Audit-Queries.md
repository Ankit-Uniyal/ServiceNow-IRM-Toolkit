# 🔎 IRM Compliance Audit Queries

## Overview
This file contains ready-to-use encoded queries and GlideRecord scripts for performing
GRC audits on ServiceNow IRM configuration, data quality, and process adherence.

**Usage**: Run in ServiceNow Background Scripts or use as Encoded Queries in reports.

---

## 🔍 RISK MANAGEMENT AUDIT QUERIES

### 1. Risks with No Owner
```javascript
// Encoded Query for report:
// state=open^ownerISEMPTY

var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('owner', '');
gr.query();
gs.log('Risks without owners: ' + gr.getRowCount());
while (gr.next()) {
    gs.log('No Owner Risk: ' + gr.number + ' - ' + gr.name);
}
```

### 2. Risks Not Assessed in 12 Months
```javascript
// Encoded Query: state=open^last_assessed_onRELATIVELE@year@ago@1

var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('last_assessed_on', '<', gs.daysAgo(365));
gr.orderBy('last_assessed_on');
gr.query();

gs.log('=== RISKS NOT ASSESSED IN 12+ MONTHS ===');
while (gr.next()) {
    var daysSince = gs.dateDiff(gr.last_assessed_on + '', gs.nowDateTime(), true);
    gs.log('Risk: ' + gr.number + ' | Days Since Assessment: ' + daysSince);
}
```

### 3. Critical Risks Without Treatment Plans
```javascript
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('residual_score', '>=', 16);
gr.query();

var noTreatment = 0;
while (gr.next()) {
    var task = new GlideRecord('sn_risk_risk_response_task');
    task.addQuery('risk', gr.sys_id);
    task.addQuery('state', '!=', 'closed');
    task.query();
    
    if (!task.hasNext()) {
        noTreatment++;
        gs.log('Critical risk without open treatment: ' + gr.number + ' - ' + gr.name);
    }
}
gs.log('Critical risks without treatment plans: ' + noTreatment);
```

### 4. Risk Register Completeness Check
```javascript
// Check all mandatory fields are populated
var requiredFields = ['name', 'category', 'owner', 'likelihood', 'impact', 'description'];

var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.query();

var issues = 0;
while (gr.next()) {
    for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        if (gr[field].nil() || gr[field].toString() == '') {
            gs.log('Missing field [' + field + '] on risk: ' + gr.number);
            issues++;
        }
    }
}
gs.log('Total data quality issues found: ' + issues);
```

---

## 📋 POLICY & COMPLIANCE AUDIT QUERIES

### 5. Controls with Failed Tests (Last 90 Days)
```javascript
// Encoded Query: result=fail^tested_onONLast 90 days

var gr = new GlideRecord('sn_compliance_test_result');
gr.addQuery('result', 'fail');
gr.addQuery('tested_on', '>=', gs.daysAgo(90));
gr.orderByDesc('tested_on');
gr.query();

gs.log('=== FAILED CONTROL TESTS (LAST 90 DAYS) ===');
while (gr.next()) {
    gs.log('Control: ' + gr.test_plan.control.getDisplayValue() +
            ' | Test Date: ' + gr.tested_on +
            ' | Tester: ' + gr.tested_by.getDisplayValue() +
            ' | Finding Created: ' + (!gr.finding.nil() ? 'Yes' : 'No'));
}
```

### 6. Open Policy Exceptions Beyond Expiry
```javascript
// Encoded Query: state=approved^expiry_date<javascript:gs.nowDateTime()

var gr = new GlideRecord('sn_compliance_exception');
gr.addQuery('state', 'approved');
gr.addQuery('expiry_date', '<', gs.nowDateTime());
gr.query();

gs.log('=== EXPIRED EXCEPTIONS STILL MARKED APPROVED ===');
while (gr.next()) {
    gs.log('Exception: ' + gr.number + ' | Control: ' + gr.control.getDisplayValue() +
            ' | Expired: ' + gr.expiry_date + ' | Approver: ' + gr.approver.getDisplayValue());
}
```

### 7. Policies Without Attestion Requirements
```javascript
// Find published policies with no attestation records
var gr = new GlideRecord('sn_compliance_policy');
gr.addQuery('state', 'published');
gr.addQuery('requires_attestation', true);
gr.query();

while (gr.next()) {
    var attestation = new GlideRecord('sn_compliance_attestation');
    attestation.addQuery('policy', gr.sys_id);
    attestation.query();
    
    if (!attestation.hasNext()) {
        gs.log('Policy with no attestations: ' + gr.name + ' | Owner: ' + gr.owner.getDisplayValue());
    }
}
```

### 8. ISO 27001 Control Coverage
```javascript
// Audit ISO 27001 Annex A control coverage
var gr = new GlideRecord('sn_compliance_control_objective');
gr.addQuery('authority_document.name', 'CONTAINS', 'ISO 27001');
gr.query();

var total = 0, mapped = 0, tested = 0;
while (gr.next()) {
    total++;
    
    var ctrl = new GlideRecord('sn_compliance_control');
    ctrl.addQuery('control_objective', gr.sys_id);
    ctrl.addQuery('active', true);
    ctrl.query();
    
    if (ctrl.hasNext()) {
        mapped++;
        // Check if tested
        while (ctrl.next()) {
            var result = new GlideRecord('sn_compliance_test_result');
            result.addQuery('test_plan.control', ctrl.sys_id);
            result.query();
            if (result.hasNext()) { tested++; break; }
        }
    }
}

gs.log('ISO 27001 Coverage:');
gs.log('Total Requirements: ' + total);
gs.log('With Controls: ' + mapped + ' (' + Math.round(mapped/total*100) + '%)');
gs.log('Controls Tested: ' + tested + ' (' + Math.round(tested/total*100) + '%)');
```

---

## 🔍 AUDIT MANAGEMENT AUDIT QUERIES

### 9. Audit Findings Overdue Beyond 90 Days
```javascript
// Encoded Query: state!=closed^due_dateRELATIVELE@month@ago@3

var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', '!=', 'closed');
gr.addQuery('due_date', '<', gs.daysAgo(90));
gr.orderBy('due_date');
gr.query();

gs.log('=== FINDINGS OVERDUE 90+ DAYS ===');
while (gr.next()) {
    var daysOverdue = gs.dateDiff(gr.due_date + '', gs.nowDateTime(), true);
    gs.log('Finding: ' + gr.number +
            ' | Severity: ' + gr.severity.getDisplayValue() +
            ' | Owner: ' + gr.owner.getDisplayValue() +
            ' | Days Overdue: ' + daysOverdue +
            ' | Mgmt Response: ' + (gr.management_response.nil() ? 'MISSING' : 'Present'));
}
```

### 10. Audit Universe Coverage Gap
```javascript
// Find audit universe entities never audited
var gr = new GlideRecord('sn_audit_audit_universe');
gr.addQuery('active', true);
gr.query();

var neverAudited = 0, total = 0;
while (gr.next()) {
    total++;
    if (gr.last_audited.nil()) {
        neverAudited++;
        gs.log('Never Audited: ' + gr.name + ' | Risk: ' + gr.risk_rating.getDisplayValue());
    }
}
gs.log('Never audited: ' + neverAudited + '/' + total);
```

### 11. Audits Without Lead Auditor
```javascript
// Encoded Query: state!=closed^lead_auditorISEMPTY

var gr = new GlideRecord('sn_audit_audit');
gr.addQuery('state', '!=', 'closed');
gr.addQuery('lead_auditor', '');
gr.query();

gs.log('Audits without lead auditor: ' + gr.getRowCount());
while (gr.next()) {
    gs.log('Audit: ' + gr.number + ' - ' + gr.name + ' | State: ' + gr.state.getDisplayValue());
}
```

---

## 🏢 VENDOR RISK AUDIT QUERIES

### 12. Critical Vendors Without Current Assessment
```javascript
// Tier 1 vendors with no assessment in last 12 months
var gr = new GlideRecord('sn_vdr_vendor_profile');
gr.addQuery('tier', 'tier_1');
gr.addQuery('status', 'active');
gr.query();

var noAssessment = 0;
while (gr.next()) {
    var assessment = new GlideRecord('sn_vdr_vendor_assessment');
    assessment.addQuery('vendor', gr.company);
    assessment.addQuery('state', 'approved');
    assessment.addQuery('approved_date', '>=', gs.daysAgo(365));
    assessment.setLimit(1);
    assessment.query();
    
    if (!assessment.hasNext()) {
        noAssessment++;
        gs.log('Tier 1 vendor without current assessment: ' + gr.company.getDisplayValue());
    }
}
gs.log('Critical vendors needing assessment: ' + noAssessment);
```

---

## 🔧 PLATFORM HEALTH CHECKS

### 13. IRM Platform Health Dashboard Script
```javascript
// Run weekly to check platform health
gs.log('=== IRM PLATFORM HEALTH CHECK - ' + gs.nowDateTime() + ' ===');

// Check 1: Risks without owners
var noOwnerRisks = new GlideAggregate('sn_risk_risk');
noOwnerRisks.addQuery('state', 'open');
noOwnerRisks.addQuery('owner', '');
noOwnerRisks.addAggregate('COUNT');
noOwnerRisks.query();
noOwnerRisks.next();
gs.log('[RISK] No-owner risks: ' + noOwnerRisks.getAggregate('COUNT'));

// Check 2: Overdue policy reviews
var overduePolicies = new GlideAggregate('sn_compliance_policy');
overduePolicies.addQuery('state', 'published');
overduePolicies.addQuery('review_date', '<', gs.nowDateTime());
overduePolicies.addAggregate('COUNT');
overduePolicies.query();
overduePolicies.next();
gs.log('[COMPLIANCE] Overdue policy reviews: ' + overduePolicies.getAggregate('COUNT'));

// Check 3: Critical open findings
var critFindings = new GlideAggregate('sn_audit_finding');
critFindings.addQuery('severity', 'critical');
critFindings.addQuery('state', '!=', 'closed');
critFindings.addAggregate('COUNT');
critFindings.query();
critFindings.next();
gs.log('[AUDIT] Open critical findings: ' + critFindings.getAggregate('COUNT'));

// Check 4: KRI breaches
var kriBreaches = new GlideAggregate('sn_risk_kri');
kriBreaches.addQuery('threshold_breach', true);
kriBreaches.addQuery('active', true);
kriBreaches.addAggregate('COUNT');
kriBreaches.query();
kriBreaches.next();
gs.log('[KRI] Active KRI breaches: ' + kriBreaches.getAggregate('COUNT'));

gs.log('=== HEALTH CHECK COMPLETE ===');
```

### 14. IRM Data Quality Score
```javascript
// Calculate overall IRM data quality score
var score = 100;
var issues = [];

// Check 1: Risks without owners (-5 per risk)
var noOwner = new GlideAggregate('sn_risk_risk');
noOwner.addQuery('state', 'open');
noOwner.addQuery('owner', '');
noOwner.addAggregate('COUNT');
noOwner.query();
noOwner.next();
var noOwnerCount = parseInt(noOwner.getAggregate('COUNT'));
score -= noOwnerCount * 2;
if (noOwnerCount > 0) issues.push('Risks without owners: ' + noOwnerCount);

// Check 2: Overdue assessments (-3 per assessment)
var overdueAssess = new GlideAggregate('sn_risk_risk_assessment');
overdueAssess.addQuery('state', 'IN', 'open,in_progress');
overdueAssess.addQuery('due_date', '<', gs.nowDateTime());
overdueAssess.addAggregate('COUNT');
overdueAssess.query();
overdueAssess.next();
var overdueCount = parseInt(overdueAssess.getAggregate('COUNT'));
score -= overdueCount * 1;
if (overdueCount > 0) issues.push('Overdue assessments: ' + overdueCount);

// Check 3: Controls without test plans (-2 per control)
var noTestPlan = 0;
var controls = new GlideRecord('sn_compliance_control');
controls.addQuery('active', true);
controls.query();
while (controls.next()) {
    var tp = new GlideRecord('sn_compliance_test_plan');
    tp.addQuery('control', controls.sys_id);
    tp.setLimit(1);
    tp.query();
    if (!tp.hasNext()) noTestPlan++;
}
score -= noTestPlan;
if (noTestPlan > 0) issues.push('Controls without test plans: ' + noTestPlan);

score = Math.max(0, score);

gs.log('IRM Data Quality Score: ' + score + '/100');
gs.log('Issues Found:');
issues.forEach(function(issue) { gs.log('  - ' + issue); });
```

---

## 📊 ENCODED QUERIES QUICK REFERENCE

```
# RISK QUERIES
All Open Critical Risks:           state=open^residual_score>=16
Risks Exceeding Appetite:          state=open^residual_score>risk_appetite
Risks Without Controls:            state=open^sys_idNOT INsn_risk_m2m_risk_control.risk
Risks Owned by Inactive Users:     owner.active=false^state=open

# COMPLIANCE QUERIES
Failed Controls This Quarter:      result=fail^tested_onONThis quarter
Overdue Reviews:                   state=published^review_date<javascript:gs.nowDateTime()
Open Exceptions:                   state=IN(open,approved)^expiry_date<javascript:gs.nowDateTime()

# AUDIT QUERIES
Critical Open Findings:            severity=critical^state!=closed
Overdue Findings 90+ Days:         state!=closed^due_dateRELATIVELE@month@ago@3
Audits Without End Date:           state!=closed^end_dateISEMPTY

# VENDOR QUERIES
Tier 1 Vendors Overdue:            tier=tier_1^next_assessment_date<javascript:gs.nowDateTime()
High Risk Vendors:                 score>=70^state=approved
```

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../README.md)*
