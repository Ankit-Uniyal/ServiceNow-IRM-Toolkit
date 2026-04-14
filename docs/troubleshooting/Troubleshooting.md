# 🛠️ ServiceNow IRM Troubleshooting Guide

## Overview
Common issues and fixes for ServiceNow IRM platform administrators,
developers, and configurators.

---

## RISK MANAGEMENT ISSUES

### Issue 1: Risk Score Not Calculating
**Symptom**: Inherent/residual score remains 0 after setting likelihood and impact.
**Cause**: Business Rule for score calculation may be disabled or has an error.
**Fix**:
```javascript
// Check if Business Rule 'Calculate Risk Score' is active
var gr = new GlideRecord('sys_script');
gr.addQuery('name', 'CONTAINS', 'risk score');
gr.addQuery('table', 'sn_risk_risk');
gr.query();
while (gr.next()) {
    gs.log('BR: ' + gr.name + ' | Active: ' + gr.active + ' | Trigger: ' + gr.when);
}

// Manual score recalculation for all open risks:
var risks = new GlideRecord('sn_risk_risk');
risks.addQuery('state', 'open');
risks.query();
while (risks.next()) {
    risks.inherent_score = parseInt(risks.likelihood) * parseInt(risks.impact);
    risks.update();
}
```

### Issue 2: Risk Assessment Not Triggering Notification
**Symptom**: Approver not receiving email when assessment state changes.
**Cause**: Email notification record disabled, or Flow Designer flow error.
**Fix**:
```javascript
// Check notification records for risk assessment
var notif = new GlideRecord('sysevent_email_action');
notif.addQuery('name', 'CONTAINS', 'risk assessment');
notif.query();
while (notif.next()) {
    gs.log('Notification: ' + notif.name + ' | Active: ' + notif.active);
}

// Check event log for assessment events
var events = new GlideRecord('sysevent');
events.addQuery('name', 'CONTAINS', 'risk');
events.addQuery('sys_created_on', '>=', gs.daysAgo(1));
events.orderByDesc('sys_created_on');
events.setLimit(20);
events.query();
while (events.next()) {
    gs.log('Event: ' + events.name + ' | State: ' + events.state + ' | Created: ' + events.sys_created_on);
}
```

---

## POLICY & COMPLIANCE ISSUES

### Issue 3: Control Test Plans Not Generating
**Symptom**: No test plans exist even though controls are active.
**Cause**: Missing scheduled job or automation script.
**Fix**:
```javascript
// Check scheduled jobs for test plan generation
var jobs = new GlideRecord('sysauto_script');
jobs.addQuery('name', 'CONTAINS', 'test plan');
jobs.query();
while (jobs.next()) {
    gs.log('Job: ' + jobs.name + ' | Active: ' + jobs.active + ' | Next Run: ' + jobs.next_action);
}

// Manually create test plans for controls missing them
var controls = new GlideRecord('sn_compliance_control');
controls.addQuery('active', true);
controls.query();

var created = 0;
while (controls.next()) {
    var existing = new GlideRecord('sn_compliance_test_plan');
    existing.addQuery('control', controls.sys_id);
    existing.setLimit(1);
    existing.query();
    
    if (!existing.hasNext()) {
        var tp = new GlideRecord('sn_compliance_test_plan');
        tp.initialize();
        tp.control = controls.sys_id;
        tp.name = 'Test Plan - ' + controls.name;
        tp.frequency = 'annual';
        tp.owner = controls.owner;
        tp.insert();
        created++;
    }
}
gs.log('Created ' + created + ' missing test plans');
```

### Issue 4: Policy Attestation Emails Not Sending
**Symptom**: Employees not receiving attestation requests.
**Cause**: Email notification blocked or attest records not created.
**Fix**:
```javascript
// Check if attestation records were created for a policy
var gr = new GlideRecord('sn_compliance_attestation');
gr.addQuery('policy', 'POLICY_SYS_ID');  // Replace with actual sys_id
gr.query();
gs.log('Total attestation records: ' + gr.getRowCount());

// Check email queue for stuck emails
var emailQueue = new GlideRecord('sys_email');
emailQueue.addQuery('state', 'ready');
emailQueue.addQuery('type', 'receive');
emailQueue.query();
gs.log('Emails in queue: ' + emailQueue.getRowCount());
```

---

## AUDIT MANAGEMENT ISSUES

### Issue 5: Audit Universe Not Showing in Annual Plan
**Symptom**: Audit universe entities missing from plan selection.
**Cause**: Audit universe records set to inactive.
**Fix**:
```javascript
// Count active vs inactive universe entities
var active = new GlideAggregate('sn_audit_audit_universe');
active.addQuery('active', true);
active.addAggregate('COUNT');
active.query();
active.next();
gs.log('Active entities: ' + active.getAggregate('COUNT'));

var inactive = new GlideAggregate('sn_audit_audit_universe');
inactive.addQuery('active', false);
inactive.addAggregate('COUNT');
inactive.query();
inactive.next();
gs.log('Inactive entities: ' + inactive.getAggregate('COUNT'));

// Reactivate specific entities if needed
// var gr = new GlideRecord('sn_audit_audit_universe');
// gr.addQuery('name', 'ENTITY_NAME');
// gr.query();
// if (gr.next()) { gr.active = true; gr.update(); }
```

### Issue 6: Finding Cannot Be Closed
**Symptom**: Close button grayed out on finding record.
**Cause**: Missing mandatory fields (management response, evidence) or approval pending.
**Fix**:
```javascript
// Check required fields for finding closure
var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', '!=', 'closed');
gr.query();

while (gr.next()) {
    var missing = [];
    if (gr.management_response.nil()) missing.push('management_response');
    if (gr.owner.nil()) missing.push('owner');
    
    if (missing.length > 0) {
        gs.log('Finding ' + gr.number + ' missing: ' + missing.join(', '));
    }
}
```

---

## PERFORMANCE ISSUES

### Issue 7: IRM Dashboard Loading Slowly
**Symptom**: Dashboard widgets timeout or take >30 seconds to load.
**Cause**: Report queries not using indexes, too much data.
**Fix**:
```javascript
// Identify slow queries by checking sys_log for timeout messages
var log = new GlideRecord('syslog');
log.addQuery('message', 'CONTAINS', 'timeout');
log.addQuery('sys_created_on', '>=', gs.daysAgo(1));
log.orderByDesc('sys_created_on');
log.setLimit(20);
log.query();

while (log.next()) {
    gs.log('Slow Query: ' + log.message.substring(0, 200));
}

// Add date filters to risk report queries
// Always filter by active=true and state to reduce data set
// Use GlideAggregate instead of GlideRecord for counts
```

### Issue 8: Business Rules Causing Infinite Loop
**Symptom**: Record save hangs indefinitely or throws recursion error.
**Cause**: Business Rule updating a field that triggers same BR.
**Fix**:
```javascript
// Disable problematic BR temporarily
var gr = new GlideRecord('sys_script');
gr.addQuery('name', 'PROBLEMATIC_BR_NAME');
gr.query();
if (gr.next()) {
    gr.active = false;
    gr.update();
    gs.log('Disabled BR: ' + gr.name);
}

// Fix: Add gs.getSession().isInteractive() check
// Or use current.setWorkflow(false) to prevent re-triggering
// Fix in BR:
// if (current.operation() != 'update' || !current.sys_updated_by.changes()) {
//   // main logic here
// }
```

---

## DATA QUALITY ISSUES

### Issue 9: Duplicate Risk Records
**Symptom**: Same risk appears multiple times in register.
**Fix**:
```javascript
// Find potential duplicate risks by name similarity
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.query();

var names = {};
var duplicates = [];

while (gr.next()) {
    var normalizedName = gr.name.toString().toLowerCase().trim();
    if (names[normalizedName]) {
        duplicates.push({
            original: names[normalizedName],
            duplicate: gr.number.toString(),
            name: gr.name.toString()
        });
    } else {
        names[normalizedName] = gr.number.toString();
    }
}

gs.log('Potential duplicates found: ' + duplicates.length);
duplicates.forEach(function(d) {
    gs.log('DUPLICATE: ' + d.original + ' and ' + d.duplicate + ' | Name: ' + d.name);
});
```

### Issue 10: Orphaned Records After User Deletion
**Symptom**: Risks/findings assigned to deleted users.
**Fix**:
```javascript
// Find IRM records with inactive owners
var tables = ['sn_risk_risk', 'sn_audit_finding', 'sn_compliance_control'];

tables.forEach(function(table) {
    var gr = new GlideRecord(table);
    gr.addQuery('owner.active', false);
    gr.query();
    gs.log(table + ' with inactive owners: ' + gr.getRowCount());
    while (gr.next()) {
        gs.log('  Record: ' + gr.number + ' | Inactive Owner: ' + gr.owner.getDisplayValue());
    }
});
```

---

## INTEGRATION ISSUES

### Issue 11: REST API Returning 403 Forbidden
**Symptom**: External system cannot access ServiceNow IRM API.
**Fix**:
- Verify API user has correct roles: `rest_service`, module-specific read/write roles
- Check IP allowlist in ServiceNow security settings
- Verify OAuth token not expired
- Check table-level ACLs for the integration user

### Issue 12: KRI Values Not Updating from External System
**Symptom**: KRI values show stale data.
**Fix**:
```javascript
// Check Integration Hub flow execution log
var flowLog = new GlideRecord('sys_flow_log');
flowLog.addQuery('flow', 'KRI_FLOW_SYS_ID');  // Replace with actual flow sys_id
flowLog.addQuery('sys_created_on', '>=', gs.daysAgo(7));
flowLog.orderByDesc('sys_created_on');
flowLog.setLimit(10);
flowLog.query();

while (flowLog.next()) {
    gs.log('Flow Execution: ' + flowLog.sys_created_on +
            ' | Status: ' + flowLog.status +
            ' | Error: ' + (flowLog.error_message.nil() ? 'None' : flowLog.error_message));
}
```

---

## QUICK DIAGNOSTIC SCRIPTS

### Full IRM Health Check
```javascript
// Run in Background Scripts for quick health check
gs.log('====== IRM HEALTH CHECK ======');

var checks = [
    { name: 'Open Critical Risks', table: 'sn_risk_risk', query: 'state=open^residual_score>=16' },
    { name: 'Risks Without Owners', table: 'sn_risk_risk', query: 'state=open^ownerISEMPTY' },
    { name: 'Overdue Assessments', table: 'sn_risk_risk_assessment', query: 'state=open^due_date<' + gs.nowDateTime() },
    { name: 'KRI Breaches', table: 'sn_risk_kri', query: 'threshold_breach=true^active=true' },
    { name: 'Critical Open Findings', table: 'sn_audit_finding', query: 'severity=critical^state!=closed' },
    { name: 'Overdue Policy Reviews', table: 'sn_compliance_policy', query: 'state=published^review_date<' + gs.nowDateTime() },
    { name: 'Open Exceptions', table: 'sn_compliance_exception', query: 'state=approved^expiry_date<' + gs.nowDateTime() }
];

checks.forEach(function(check) {
    var agg = new GlideAggregate(check.table);
    agg.addEncodedQuery(check.query);
    agg.addAggregate('COUNT');
    agg.query();
    agg.next();
    var count = parseInt(agg.getAggregate('COUNT'));
    var status = count === 0 ? 'OK' : 'ACTION NEEDED';
    gs.log('[' + status + '] ' + check.name + ': ' + count);
});

gs.log('=========================');
```

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
