# 🔍 Audit Management Module - Complete Guide

## Overview
ServiceNow Audit Management supports the complete internal audit lifecycle: universe maintenance, risk-based annual planning, engagement execution, fieldwork, issue/finding management, and reporting. It aligns with IIA Standards (International Standards for the Professional Practice of Internal Auditing).

---

## Core Components

### 1. Audit Universe
The Audit Universe is the comprehensive inventory of all auditable entities (processes, systems, departments, locations) that the internal audit function could potentially audit.

**Key Table: `sn_audit_audit_universe`**
| Field | Description |
|-------|-------------|
| name | Entity name (e.g., "Payroll Process") |
| category | Category (IT, Finance, Operations, HR) |
| owner | Process/entity owner |
| risk_rating | Inherent risk rating |
| last_audited | Date of last audit |
| audit_frequency | Required audit frequency |
| entity_type | Type (Process, System, Department, Location) |

### 2. Audit Planning
Risk-based annual/multi-year audit plan creation with resource allocation.

**Key Table: `sn_audit_plan`**
| Field | Description |
|-------|-------------|
| name | Plan name (e.g., "FY2026 Audit Plan") |
| year | Fiscal year |
| state | Draft/Approved/In Progress/Closed |
| total_budget_hours | Planned audit hours |
| used_hours | Actual hours used |

### 3. Audit Engagement
Individual audit projects with full lifecycle tracking.

**Key Table: `sn_audit_audit`**
| Field | Description |
|-------|-------------|
| number | Auto-assigned audit number |
| name | Audit name |
| state | Draft/Planning/Fieldwork/Reporting/Closure/Closed |
| audit_type | Internal/External/Regulatory/Compliance |
| audit_universe | Linked audit universe entity |
| plan | Linked audit plan |
| lead_auditor | Lead auditor (sys_user) |
| start_date | Audit start date |
| end_date | Planned end date |
| actual_end_date | Actual completion date |
| scope | Audit scope statement |
| objective | Audit objectives |
| risk | Associated risk |

### 4. Findings & Recommendations
**Key Table: `sn_audit_finding`**
| Field | Description |
|-------|-------------|
| number | Finding number |
| short_description | Finding title |
| description | Detailed finding description |
| audit | Parent audit |
| finding_type | Observation/Finding/Deficiency/Material Weakness |
| severity | Critical/High/Medium/Low/Informational |
| root_cause | Root cause analysis |
| recommendation | Auditor's recommendation |
| management_response | Management action plan |
| owner | Finding owner (responsible person) |
| due_date | Remediation due date |
| state | Open/In Progress/Closed/Risk Accepted |
| evidence | Evidence of remediation |

---

## Audit Lifecycle (IPPF-Aligned)

```
PHASE 1: PLANNING
├── Risk Assessment of Audit Universe
├── Annual Audit Plan Creation
├── Resource Allocation
└── Audit Approval by CAE/Board

PHASE 2: ENGAGEMENT PLANNING
├── Engagement Letter / Notification
├── Preliminary Survey
├── Risk and Control Matrix (RCM)
└── Audit Program Creation

PHASE 3: FIELDWORK
├── Audit Testing Execution
├── Evidence Collection
├── Workpaper Documentation
└── Exception Identification

PHASE 4: REPORTING
├── Draft Report Preparation
├── Management Review
├── Finding Validation
└── Final Report Issuance

PHASE 5: FOLLOW-UP
├── Remediation Plan Tracking
├── Evidence Review
├── Finding Closure
└── Continuous Monitoring
```

---

## GlideRecord Scripts

### Get All Open Audit Engagements
```javascript
// Query all active audit engagements
var gr = new GlideRecord('sn_audit_audit');
gr.addQuery('state', 'IN', 'planning,fieldwork,reporting');
gr.orderBy('end_date');
gr.query();

gs.log('=== ACTIVE AUDIT ENGAGEMENTS ===');
while (gr.next()) {
    gs.log('Audit: ' + gr.number + 
            ' | Name: ' + gr.name +
            ' | State: ' + gr.state.getDisplayValue() +
            ' | Lead: ' + gr.lead_auditor.getDisplayValue() +
            ' | End Date: ' + gr.end_date);
}
```

### Get Overdue Audit Findings
```javascript
// Find all overdue open findings
var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', 'IN', 'open,in_progress');
gr.addQuery('due_date', '<', gs.nowDateTime());
gr.orderBy('due_date');
gr.query();

gs.log('=== OVERDUE FINDINGS ===');
while (gr.next()) {
    var daysPastDue = Math.round((new Date() - new Date(gr.due_date)) / (1000 * 60 * 60 * 24));
    gs.log('Finding: ' + gr.number +
            ' | ' + gr.short_description +
            ' | Severity: ' + gr.severity.getDisplayValue() +
            ' | Days Overdue: ' + daysPastDue +
            ' | Owner: ' + gr.owner.getDisplayValue());
}
```

### Audit Universe Risk Scoring
```javascript
// Score and prioritize audit universe entities
var gr = new GlideRecord('sn_audit_audit_universe');
gr.addQuery('active', true);
gr.query();

var entities = [];
while (gr.next()) {
    // Calculate risk score based on multiple factors
    var riskScore = 0;
    
    // Factor 1: Time since last audit
    if (gr.last_audited.nil()) {
        riskScore += 30; // Never audited = highest risk
    } else {
        var lastAudit = new GlideDateTime(gr.last_audited);
        var daysSince = Math.round(gs.dateDiff(gr.last_audited, gs.nowDateTime(), true));
        if (daysSince > 730) riskScore += 25; // More than 2 years
        else if (daysSince > 365) riskScore += 15; // 1-2 years
        else riskScore += 5; // Less than 1 year
    }
    
    // Factor 2: Inherent risk rating
    var riskMap = {'critical': 40, 'high': 30, 'medium': 20, 'low': 10};
    riskScore += riskMap[gr.risk_rating.toString()] || 20;
    
    // Factor 3: Open findings
    var openFindings = new GlideAggregate('sn_audit_finding');
    openFindings.addQuery('audit.audit_universe', gr.sys_id);
    openFindings.addQuery('state', '!=', 'closed');
    openFindings.addAggregate('COUNT');
    openFindings.query();
    openFindings.next();
    riskScore += parseInt(openFindings.getAggregate('COUNT')) * 5;
    
    entities.push({
        name: gr.name + '',
        score: riskScore,
        lastAudited: gr.last_audited + ''
    });
}

// Sort by risk score
entities.sort(function(a, b) { return b.score - a.score; });

gs.log('=== AUDIT UNIVERSE RISK PRIORITIZATION ===');
for (var i = 0; i < Math.min(10, entities.length); i++) {
    gs.log((i+1) + '. ' + entities[i].name + ' | Score: ' + entities[i].score);
}
```

### Create Audit Engagement from Template
```javascript
// Create a new audit engagement
function createAuditEngagement(auditData) {
    var audit = new GlideRecord('sn_audit_audit');
    audit.initialize();
    
    audit.name = auditData.name;
    audit.audit_type = auditData.type || 'internal';
    audit.state = 'draft';
    audit.lead_auditor = auditData.leadAuditorSysId;
    audit.start_date = auditData.startDate;
    audit.end_date = auditData.endDate;
    audit.scope = auditData.scope;
    audit.objective = auditData.objective;
    
    if (auditData.universeEntitySysId) {
        audit.audit_universe = auditData.universeEntitySysId;
    }
    
    var sysId = audit.insert();
    gs.log('Created Audit: ' + audit.number);
    return sysId;
}
```

### Finding Aging Report
```javascript
// Categorize open findings by age
var buckets = {
    'Current (0-30 days)': 0,
    'Aging (31-60 days)': 0,
    'Overdue (61-90 days)': 0,
    'Critical Overdue (90+ days)': 0
};

var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', 'IN', 'open,in_progress');
gr.query();

while (gr.next()) {
    var dueDate = new GlideDateTime(gr.due_date);
    var today = new GlideDateTime();
    var daysToDue = gs.dateDiff(gs.nowDateTime(), gr.due_date + '', true);
    
    if (daysToDue >= 0) {
        buckets['Current (0-30 days)']++;
    } else if (daysToDue >= -60) {
        buckets['Aging (31-60 days)']++;
    } else if (daysToDue >= -90) {
        buckets['Overdue (61-90 days)']++;
    } else {
        buckets['Critical Overdue (90+ days)']++;
    }
}

gs.log('=== FINDING AGING REPORT ===');
for (var bucket in buckets) {
    gs.log(bucket + ': ' + buckets[bucket]);
}
```

### Generate Audit Status Dashboard Data
```javascript
// Get comprehensive audit status for dashboard
var currentYear = new Date().getFullYear();
var report = {};

// Total audits in current plan
var planAudits = new GlideAggregate('sn_audit_audit');
planAudits.addQuery('plan.year', currentYear);
planAudits.addAggregate('COUNT');
planAudits.query();
planAudits.next();
report.totalPlanned = parseInt(planAudits.getAggregate('COUNT'));

// Completed audits
var completedAudits = new GlideAggregate('sn_audit_audit');
completedAudits.addQuery('plan.year', currentYear);
completedAudits.addQuery('state', 'closed');
completedAudits.addAggregate('COUNT');
completedAudits.query();
completedAudits.next();
report.completed = parseInt(completedAudits.getAggregate('COUNT'));

// In-progress audits
var inProgressAudits = new GlideAggregate('sn_audit_audit');
inProgressAudits.addQuery('plan.year', currentYear);
inProgressAudits.addQuery('state', 'IN', 'planning,fieldwork,reporting');
inProgressAudits.addAggregate('COUNT');
inProgressAudits.query();
inProgressAudits.next();
report.inProgress = parseInt(inProgressAudits.getAggregate('COUNT'));

// Open findings by severity
var severities = ['critical', 'high', 'medium', 'low'];
report.findings = {};
for (var i = 0; i < severities.length; i++) {
    var sev = severities[i];
    var findings = new GlideAggregate('sn_audit_finding');
    findings.addQuery('state', '!=', 'closed');
    findings.addQuery('severity', sev);
    findings.addAggregate('COUNT');
    findings.query();
    findings.next();
    report.findings[sev] = parseInt(findings.getAggregate('COUNT'));
}

report.completionRate = report.totalPlanned > 0 ? 
    Math.round((report.completed / report.totalPlanned) * 100) : 0;

gs.log(JSON.stringify(report, null, 2));
```

### Bulk Close Validated Findings
```javascript
// Close findings where evidence has been reviewed and remediation verified
// CAREFUL: Only use after proper review process

var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', 'in_progress');
gr.addQuery('evidence_validated', true); // Custom field - evidence validated by auditor
gr.addQuery('management_response', '!=', ''); // Management response provided
gr.query();

var closedCount = 0;
while (gr.next()) {
    gr.state = 'closed';
    gr.closed_date = gs.nowDateTime();
    gr.closed_by = gs.getUserID();
    gr.update();
    closedCount++;
    gs.log('Closed finding: ' + gr.number);
}
gs.log('Total findings closed: ' + closedCount);
```

### Audit Hours Tracking
```javascript
// Track planned vs actual audit hours per engagement
var gr = new GlideRecord('sn_audit_audit');
gr.addQuery('state', 'IN', 'fieldwork,reporting,closed');
gr.query();

gs.log('=== AUDIT HOURS TRACKING ===');
while (gr.next()) {
    var planned = parseFloat(gr.planned_hours) || 0;
    var actual = parseFloat(gr.actual_hours) || 0;
    var variance = actual - planned;
    var variancePct = planned > 0 ? Math.round((variance / planned) * 100) : 0;
    
    gs.log('Audit: ' + gr.number + ' - ' + gr.name +
            ' | Planned: ' + planned + 'h' +
            ' | Actual: ' + actual + 'h' +
            ' | Variance: ' + (variance > 0 ? '+' : '') + variance + 'h (' + variancePct + '%)');
}
```

---

## Encoded Queries

### Critical/High Severity Open Findings
```
state=open^ORstate=in_progress^severity=critical^ORseverity=high
```

### Audits in Fieldwork Stage
```
state=fieldwork^active=true
```

### Findings Due This Month
```
due_dateBETWEENjavascript:gs.beginningOfThisMonth()@javascript:gs.endOfThisMonth()^state!=closed
```

### Audit Universe Entities Not Audited in 2 Years
```
last_auditedRELATIVELE@year@ago@2^ORlast_auditedISEMPTY
```

---

## Audit Program Templates

### IT General Controls (ITGC) Audit Program
```javascript
// Create standard ITGC audit program items
var itgcTests = [
    {name: 'User Access Management - Provisioning', objective: 'Verify access is approved and appropriate', testSteps: 'Sample 25 new user access requests from past 90 days...'},
    {name: 'User Access Management - Deprovisioning', objective: 'Verify terminated employees access is removed timely', testSteps: 'Sample 25 terminated employees and verify access removed within 24 hours...'},
    {name: 'Privileged Access Management', objective: 'Verify admin/privileged access is controlled and monitored', testSteps: 'Obtain list of all privileged accounts and verify business justification...'},
    {name: 'Change Management', objective: 'Verify IT changes follow approved change management process', testSteps: 'Sample 25 production changes and verify approval, testing, and backout plans...'},
    {name: 'Backup and Recovery', objective: 'Verify backups are performed and recovery tested', testSteps: 'Review backup logs for past 30 days and verify recovery test results...'},
    {name: 'Incident Response', objective: 'Verify security incidents are identified and responded to', testSteps: 'Review incident log and verify escalation and resolution process...'}
];

function createAuditProgram(auditSysId, tests) {
    for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        var task = new GlideRecord('sn_audit_task');
        task.audit = auditSysId;
        task.name = test.name;
        task.objective = test.objective;
        task.test_steps = test.testSteps;
        task.state = 'open';
        task.sequence = (i + 1) * 10;
        task.insert();
    }
    gs.log('Created ' + tests.length + ' audit program items');
}
```

---

## Business Rules

### Auto-escalate Critical Findings
```javascript
// Business Rule: After Insert on sn_audit_finding
// Condition: severity = critical

(function executeRule(current, previous) {
    if (current.severity == 'critical') {
        // Notify CAE and Audit Committee
        gs.eventQueue('audit.finding.critical', current, current.audit.lead_auditor, gs.getUserID());
        
        // Set due date to 30 days for critical findings
        var dueDate = new GlideDateTime();
        dueDate.addDaysUTC(30);
        current.due_date = dueDate;
        current.update();
        
        gs.log('Critical finding created and escalated: ' + current.number);
    }
})(current, previous);
```

---

## Key Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Audit Plan Completion Rate | Completed Audits / Planned Audits × 100 | ≥90% |
| Finding Closure Rate | Closed Findings / Total Findings × 100 | ≥80% |
| Avg Days to Close Finding | Sum(Close Date - Open Date) / Count | ≤45 days |
| Critical Finding Response | Critical Findings with Response / Total Critical × 100 | 100% |
| Audit Universe Coverage | Entities Audited / Total Universe × 100 | ≥70% |
| Report Issuance Timeliness | Reports Issued On Time / Total Reports × 100 | ≥95% |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
