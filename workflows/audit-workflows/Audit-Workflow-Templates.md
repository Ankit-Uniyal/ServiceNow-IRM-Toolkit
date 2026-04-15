# ServiceNow IRM - Audit Management Workflow Templates

> **Module:** Audit Management | **Version:** 2.0 | **Author:** Ankit Uniyal

## Overview

Flow Designer and Workflow templates for automating the complete internal audit lifecycle in ServiceNow Audit Management.

---

## 1. Audit Planning Workflow

### Flow: Annual Audit Plan Creation
```
Trigger: Scheduled - September 1st annually (planning for next year)
Actions:
  1. Generate Audit Universe review tasks
  2. Create Draft Audit Plan for upcoming year
  3. Pull risk-based prioritization scores from Risk module
  4. Generate preliminary audit schedule template
  5. Send Plan for CAE (Chief Audit Executive) review
  6. Schedule Audit Committee presentation
  7. On Approval: Publish Annual Audit Plan
  8. Create all Engagement shells for the year
```

### Audit Universe Scoring Script:
```javascript
// Risk-based audit prioritization
function scoreAuditUniverse() {
    var gr = new GlideRecord('sn_audit_audit_universe');
    gr.addQuery('active', true);
    gr.query();
    
    while (gr.next()) {
        var riskScore = parseFloat(gr.getValue('inherent_risk_score') || '0');
        var lastAuditMonths = 24; // default
        
        var lastAuditGr = new GlideRecord('sn_audit_audit');
        lastAuditGr.addQuery('auditable_entity', gr.getUniqueValue());
        lastAuditGr.addQuery('state', 'closed');
        lastAuditGr.orderByDesc('completion_date');
        lastAuditGr.setLimit(1);
        lastAuditGr.query();
        
        if (lastAuditGr.next()) {
            var lastDate = lastAuditGr.getGlideObject('completion_date');
            var now = new GlideDateTime();
            lastAuditMonths = Math.abs(GlideDateTime.subtract(lastDate, now).getRoundedDayPart()) / 30;
        }
        
        // Audit Priority Score = Risk Score * Time Since Last Audit Factor
        var timeFactors = { 0: 1.0, 6: 1.2, 12: 1.5, 18: 1.8, 24: 2.0 };
        var timeFactor = 1.0;
        Object.keys(timeFactors).forEach(function(months) {
            if (lastAuditMonths >= parseInt(months)) timeFactor = timeFactors[months];
        });
        
        var priorityScore = Math.round(riskScore * timeFactor);
        gr.setValue('audit_priority_score', priorityScore);
        gr.setValue('time_since_last_audit_months', Math.round(lastAuditMonths));
        gr.update();
    }
    gs.info('Audit Universe scoring complete');
}
scoreAuditUniverse();
```

---

## 2. Audit Engagement Launch Workflow

### Flow: Audit Engagement Kickoff
```
Trigger: State changes to "Planning" on [sn_audit_audit]
Actions:
  1. Create Engagement Opening Meeting task
  2. Generate Audit Notification Letter template
  3. Create Risk and Control Matrix (RACM) from linked controls
  4. Build initial test program from control library
  5. Assign Lead Auditor and team members
  6. Set fieldwork start/end dates
  7. Send kickoff notification to Auditee management
  8. Create audit workspace in ServiceNow
```

### Engagement Setup Script:
```javascript
// Auto-create audit tasks from engagement template
function setupAuditEngagement(auditSysId) {
    var auditGr = new GlideRecord('sn_audit_audit');
    if (!auditGr.get(auditSysId)) return;
    
    var tasks = [
        { name: 'Opening Meeting', phase: 'planning', duration_days: 2 },
        { name: 'Risk Assessment', phase: 'planning', duration_days: 3 },
        { name: 'Audit Program Development', phase: 'planning', duration_days: 5 },
        { name: 'Fieldwork - Document Review', phase: 'fieldwork', duration_days: 5 },
        { name: 'Fieldwork - Control Testing', phase: 'fieldwork', duration_days: 10 },
        { name: 'Interviews and Walkthroughs', phase: 'fieldwork', duration_days: 3 },
        { name: 'Draft Report Preparation', phase: 'reporting', duration_days: 5 },
        { name: 'Management Response', phase: 'reporting', duration_days: 7 },
        { name: 'Final Report Issuance', phase: 'reporting', duration_days: 2 }
    ];
    
    var startDate = new GlideDateTime(auditGr.getValue('planned_start_date') || new GlideDateTime().getValue());
    
    tasks.forEach(function(task) {
        var taskGr = new GlideRecord('sn_audit_audit_task');
        taskGr.initialize();
        taskGr.setValue('audit', auditSysId);
        taskGr.setValue('short_description', task.name);
        taskGr.setValue('phase', task.phase);
        taskGr.setValue('planned_start_date', startDate.getValue());
        
        var endDate = new GlideDateTime(startDate.getValue());
        endDate.addDaysLocalTime(task.duration_days);
        taskGr.setValue('planned_end_date', endDate.getValue());
        taskGr.setValue('assigned_to', auditGr.getValue('lead_auditor'));
        taskGr.insert();
        
        startDate = new GlideDateTime(endDate.getValue());
    });
    
    gs.info('Created ' + tasks.length + ' tasks for audit ' + auditGr.getValue('number'));
}
```

---

## 3. Audit Fieldwork Workflow

### Flow: Evidence Collection and Control Testing
```
Trigger: State changes to "Fieldwork" on [sn_audit_audit]
Actions:
  1. Activate all control test tasks
  2. Send evidence request emails to control owners
  3. Start evidence collection timer
  4. For each Test Program Step:
     a. Assign to auditor
     b. Set evidence due date
     c. Enable attachment uploads
  5. On Evidence Submission by auditee:
     a. Notify auditor of new evidence
     b. Update evidence received status
  6. Monitor for outstanding evidence requests
  7. Escalate overdue requests after 5 business days
```

### Evidence Request Script:
```javascript
// Send bulk evidence requests to control owners
function sendEvidenceRequests(auditSysId) {
    var requestCount = 0;
    var gr = new GlideRecord('sn_audit_audit_task');
    gr.addQuery('audit', auditSysId);
    gr.addQuery('phase', 'fieldwork');
    gr.addQuery('state', 'open');
    gr.query();
    
    while (gr.next()) {
        // Get related control owner
        var controlSysId = gr.getValue('control');
        if (controlSysId) {
            var controlGr = new GlideRecord('sn_compliance_control');
            if (controlGr.get(controlSysId)) {
                var ownerSysId = controlGr.getValue('owned_by');
                if (ownerSysId) {
                    gs.eventQueue('sn_audit.evidence.request', gr, ownerSysId, auditSysId);
                    requestCount++;
                    
                    var dueDate = new GlideDateTime();
                    dueDate.addDaysLocalTime(5);
                    gr.setValue('evidence_due_date', dueDate.getValue());
                    gr.update();
                }
            }
        }
    }
    gs.info('Sent ' + requestCount + ' evidence requests for audit ' + auditSysId);
    return requestCount;
}
```

---

## 4. Finding Management Workflow

### Flow: Audit Finding Creation and Tracking
```
Trigger: Record Created on [sn_audit_finding]
Actions:
  1. Auto-number the finding
  2. Classify severity (Critical/High/Medium/Low/Informational)
  3. Set remediation due date based on severity:
     - Critical: 30 days
     - High: 60 days
     - Medium: 90 days
     - Low: 180 days
  4. Assign to Auditee for management response (15 days)
  5. Send notification to Finding Owner
  6. Link to related Risk record (if applicable)
  7. Update Audit engagement finding count
```

### Finding Severity Due Date Script:
```javascript
// Business Rule: Auto-set finding due date by severity
// Table: sn_audit_finding | Before | Insert
var dueDays = { critical: 30, high: 60, medium: 90, low: 180, informational: 365 };
var severity = current.severity.getValue() || 'medium';
var days = dueDays[severity] || 90;
var dueDate = new GlideDateTime();
dueDate.addDaysLocalTime(days);
current.due_date = dueDate.getValue();

// Set management response deadline (15 days from creation)
var responseDeadline = new GlideDateTime();
responseDeadline.addDaysLocalTime(15);
current.management_response_due = responseDeadline.getValue();
```

### Flow: Finding Remediation Tracking
```
Trigger: Scheduled - Daily at 07:00
Condition: findings where state = 'open' AND due_date <= today + 14 days
Actions:
  1. Send reminder to Finding Owner
  2. If due_date <= today: Mark as Overdue
  3. If overdue > 30 days: Escalate to Audit Manager
  4. If overdue > 60 days: Escalate to CAE and Auditee Management
  5. Update finding aging reports
```

---

## 5. Audit Reporting Workflow

### Flow: Draft Audit Report Process
```
Trigger: State changes to "Reporting" on [sn_audit_audit]
Actions:
  1. Generate Draft Report template
  2. Compile all findings into report
  3. Calculate audit opinion/rating based on findings
  4. Send Draft Report to Auditee management (14-day review window)
  5. Collect management responses on each finding
  6. Schedule Exit Meeting
  7. Incorporate responses into Final Report
  8. Route Final Report for CAE approval
  9. Issue Final Report
  10. Distribute to Audit Committee
```

### Audit Opinion Calculation:
```javascript
// Calculate overall audit opinion based on findings
function calculateAuditOpinion(auditSysId) {
    var findingCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    
    var gr = new GlideRecord('sn_audit_finding');
    gr.addQuery('audit', auditSysId);
    gr.addQuery('state', '!=', 'invalid');
    gr.query();
    
    while (gr.next()) {
        var severity = gr.getValue('severity');
        if (findingCounts[severity] !== undefined) findingCounts[severity]++;
    }
    
    var opinion;
    if (findingCounts.critical > 0) {
        opinion = 'unsatisfactory';
    } else if (findingCounts.high >= 3 || (findingCounts.high >= 1 && findingCounts.medium >= 5)) {
        opinion = 'needs_improvement';
    } else if (findingCounts.high >= 1 || findingCounts.medium >= 3) {
        opinion = 'partially_effective';
    } else if (findingCounts.medium >= 1 || findingCounts.low >= 3) {
        opinion = 'generally_effective';
    } else {
        opinion = 'effective';
    }
    
    var auditGr = new GlideRecord('sn_audit_audit');
    if (auditGr.get(auditSysId)) {
        auditGr.setValue('audit_opinion', opinion);
        auditGr.update();
        gs.info('Audit ' + auditGr.getValue('number') + ' opinion: ' + opinion);
    }
    
    return { opinion: opinion, finding_counts: findingCounts };
}
```

---

## 6. Audit Closure Workflow

### Flow: Audit Engagement Closure
```
Trigger: CAE approves Final Report
Actions:
  1. Set Engagement State = "Closed"
  2. Set Completion Date = Today
  3. Send Final Report to distribution list
  4. Schedule follow-up reviews for open findings
  5. Update Audit Universe - Last Audit Date
  6. Calculate Next Scheduled Audit date
  7. Archive audit workspace
  8. Send closure notification to stakeholders
  9. Update Annual Audit Plan completion metrics
```

---

## 7. Follow-Up Audit Workflow

### Scheduled Flow: Finding Follow-Up Monitoring
```
Trigger: Scheduled - Monthly on the 1st
Actions:
  1. Query all open findings from closed audits (past 12 months)
  2. Check remediation status with auditee
  3. For findings past due: Escalate to Audit Manager
  4. Create follow-up audit tasks if needed
  5. Update finding status based on evidence received
  6. Send monthly follow-up report to CAE
```

### Follow-Up Validation Script:
```javascript
// Validate remediation evidence and close finding
function validateAndCloseFinding(findingSysId, evidenceSysId) {
    var findingGr = new GlideRecord('sn_audit_finding');
    if (!findingGr.get(findingSysId)) return false;
    
    // Verify evidence attachment exists
    var evidenceGr = new GlideRecord('sys_attachment');
    evidenceGr.addQuery('table_name', 'sn_audit_finding');
    evidenceGr.addQuery('table_sys_id', findingSysId);
    evidenceGr.query();
    
    if (!evidenceGr.next() && !evidenceSysId) {
        gs.warn('Cannot close finding ' + findingGr.getValue('number') + ' - no evidence attached');
        return false;
    }
    
    findingGr.setValue('state', 'closed');
    findingGr.setValue('closure_date', new GlideDateTime());
    findingGr.setValue('closed_by', gs.getUserID());
    findingGr.setValue('closure_verified_by', gs.getUserID());
    findingGr.update();
    
    gs.eventQueue('sn_audit.finding.closed', findingGr, findingGr.getDisplayValue('short_description'), '');
    gs.info('Finding ' + findingGr.getValue('number') + ' closed successfully');
    return true;
}
```

---

## Business Rule Templates for Audit Module

### BR-001: Auto-Number Findings
```javascript
// Business Rule: sn_audit_finding | Before | Insert
if (current.number.nil()) {
    var numGr = new GlideRecord('sys_number');
    numGr.addQuery('table', 'sn_audit_finding');
    numGr.query();
    if (numGr.next()) {
        var nextNum = parseInt(numGr.getValue('number')) + 1;
        current.number = 'AFND' + String(nextNum).padStart(7, '0');
        numGr.setValue('number', nextNum);
        numGr.update();
    }
}
```

### BR-002: Update Audit Finding Count
```javascript
// Business Rule: sn_audit_finding | After | Insert/Update/Delete
var auditSysId = current.audit.getValue();
if (auditSysId) {
    var ga = new GlideAggregate('sn_audit_finding');
    ga.addQuery('audit', auditSysId);
    ga.addQuery('state', '!=', 'invalid');
    ga.groupBy('severity');
    ga.addAggregate('COUNT');
    ga.query();
    
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    while (ga.next()) {
        var sev = ga.getValue('severity');
        if (counts[sev] !== undefined) counts[sev] = parseInt(ga.getAggregate('COUNT'));
    }
    
    var auditGr = new GlideRecord('sn_audit_audit');
    if (auditGr.get(auditSysId)) {
        auditGr.setValue('critical_findings_count', counts.critical);
        auditGr.setValue('high_findings_count', counts.high);
        auditGr.setValue('medium_findings_count', counts.medium);
        auditGr.setValue('low_findings_count', counts.low);
        auditGr.setValue('total_findings_count', counts.critical + counts.high + counts.medium + counts.low);
        auditGr.update();
    }
}
```

---

*ServiceNow IRM Toolkit - Audit Workflow Templates | Version 2.0 | Ankit Uniyal*
