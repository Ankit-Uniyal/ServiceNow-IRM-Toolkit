# 🔐 Operational Resilience - Complete Guide

## Overview
Operational Resilience in ServiceNow IRM encompasses Risk Control Self Assessment (RCSA),
Issue Management, Operational Risk tracking, and ensuring the organization can withstand,
adapt to, and recover from operational disruptions.

---

## Core Components

### 1. RCSA (Risk Control Self Assessment)
RCSA is a process where business units self-assess their risks and controls on a periodic basis.

**Key Tables:**
| Table | Label | Key Fields |
|-------|-------|------------|
| sn_rcsa_rcsa | RCSA | name, business_unit, state, due_date, owner |
| sn_rcsa_rcsa_risk | RCSA Risk | rcsa, risk, likelihood, impact, score |
| sn_rcsa_rcsa_control | RCSA Control | rcsa, control, effectiveness, gap |
| sn_rcsa_action | RCSA Action | rcsa, description, owner, due_date |

**RCSA Workflow:**
```
Initiate RCSA → Assign to Business Units →
Units Self-Assess Risks → Units Assess Controls →
Risk Manager Review → Validate/Challenge →
Approve → Monitor Actions
```

### 2. Issue Management
Track operational issues, incidents, and concerns that may indicate emerging risks.

**Key Tables:**
| Table | Label | Key Fields |
|-------|-------|------------|
| sn_risk_issue | Issue | number, name, category, state, owner, risk, source |
| sn_risk_issue_task | Issue Task | issue, assigned_to, due_date, state |

### 3. Operational Loss Events
Track actual financial losses from operational risk events (required for Basel III).

**Key Table: sn_risk_loss_event**
| Field | Description |
|-------|-------------|
| amount | Financial loss amount |
| event_type | Basel II event type category |
| business_line | Affected business line |
| root_cause | Root cause of the loss |
| risk | Associated risk in register |

---

## GlideRecord Scripts

### Get RCSA Completion Status
```javascript
var gr = new GlideRecord('sn_rcsa_rcsa');
gr.addQuery('state', 'IN', 'open,in_progress');
gr.orderBy('due_date');
gr.query();

gs.log('=== RCSA STATUS ===');
while (gr.next()) {
    var daysToDue = gs.dateDiff(gs.nowDateTime(), gr.due_date + '', true);
    gs.log('RCSA: ' + gr.name +
            ' | Business Unit: ' + gr.business_unit.getDisplayValue() +
            ' | Owner: ' + gr.owner.getDisplayValue() +
            ' | Days To Due: ' + daysToDue +
            ' | State: ' + gr.state.getDisplayValue());
}
```

### Get Open Issues by Category
```javascript
var gr = new GlideAggregate('sn_risk_issue');
gr.addQuery('state', '!=', 'closed');
gr.addAggregate('COUNT', 'category');
gr.groupBy('category');
gr.orderByAggregate('COUNT', 'category');
gr.query();

gs.log('=== OPEN ISSUES BY CATEGORY ===');
while (gr.next()) {
    gs.log('Category: ' + gr.category.getDisplayValue() +
            ' | Count: ' + gr.getAggregate('COUNT', 'category'));
}
```

### Loss Event Analysis
```javascript
// Analyze operational loss events by Basel II event type
var gr = new GlideAggregate('sn_risk_loss_event');
gr.addQuery('sys_created_on', '>=', gs.beginningOfThisYear());
gr.addAggregate('SUM', 'amount');
gr.addAggregate('COUNT');
gr.groupBy('event_type');
gr.query();

var totalLoss = 0;
gs.log('=== LOSS EVENT ANALYSIS (YTD) ===');
while (gr.next()) {
    var lossAmount = parseFloat(gr.getAggregate('SUM', 'amount'));
    totalLoss += lossAmount;
    gs.log('Event Type: ' + gr.event_type.getDisplayValue() +
            ' | Count: ' + gr.getAggregate('COUNT') +
            ' | Total Loss: $' + lossAmount.toLocaleString());
}
gs.log('TOTAL YTD OPERATIONAL LOSSES: $' + totalLoss.toLocaleString());
```

### Create RCSA for Business Unit
```javascript
function initiateRCSA(businessUnitSysId, ownerSysId, dueDate) {
    var rcsa = new GlideRecord('sn_rcsa_rcsa');
    rcsa.initialize();
    rcsa.name = 'RCSA - ' + new Date().getFullYear() + ' Q' + Math.ceil((new Date().getMonth() + 1) / 3);
    rcsa.business_unit = businessUnitSysId;
    rcsa.owner = ownerSysId;
    rcsa.state = 'open';
    rcsa.due_date = dueDate;
    rcsa.assessment_type = 'quarterly';
    
    var sysId = rcsa.insert();
    gs.log('RCSA created: ' + rcsa.number);
    return sysId;
}
```

---

## RCSA Completion Report
```javascript
// Get RCSA completion metrics
var currentQuarter = 'Q' + Math.ceil((new Date().getMonth() + 1) / 3);
var currentYear = new Date().getFullYear();

var total = new GlideAggregate('sn_rcsa_rcsa');
total.addQuery('name', 'CONTAINS', currentYear + ' ' + currentQuarter);
total.addAggregate('COUNT');
total.query();
total.next();
var totalCount = parseInt(total.getAggregate('COUNT'));

var completed = new GlideAggregate('sn_rcsa_rcsa');
completed.addQuery('name', 'CONTAINS', currentYear + ' ' + currentQuarter);
completed.addQuery('state', 'closed');
completed.addAggregate('COUNT');
completed.query();
completed.next();
var completedCount = parseInt(completed.getAggregate('COUNT'));

var rate = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
gs.log(currentYear + ' ' + currentQuarter + ' RCSA Completion: ' + completedCount + '/' + totalCount + ' (' + rate + '%)');
```

---

## Key Metrics

| Metric | Target |
|--------|--------|
| RCSA Completion Rate | 100% by quarter end |
| Issue Resolution Rate | ≥80% within SLA |
| RCSA Action Closure | ≥90% on time |
| Loss Event Reporting Rate | 100% of material events |
| Mean Time to Resolve Issue | < 30 days |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
