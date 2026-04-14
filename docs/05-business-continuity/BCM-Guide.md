# 🔄 Business Continuity Management (BCM) - Complete Guide

## Overview
ServiceNow BCM supports the planning, testing, and maintenance of organizational resilience capabilities including Business Impact Analysis (BIA), Business Continuity Plans (BCP), and Disaster Recovery (DR) documentation.

---

## BCM Framework

### ISO 22301 Aligned Lifecycle
```
UNDERSTAND THE ORGANIZATION
├── Business Impact Analysis (BIA)
├── Risk Assessment
└── Dependency Mapping

DETERMINE BCM STRATEGY
├── Recovery Strategies
├── Resource Requirements
└── Technology Solutions

DEVELOP & IMPLEMENT BCM
├── Business Continuity Plans
├── Disaster Recovery Plans
├── Crisis Communication Plans
└── Training & Awareness

TEST & EXERCISE
├── Tabletop Exercises
├── Simulation Exercises
└── Full Interruption Tests

MAINTAIN & REVIEW
├── Regular Plan Reviews
├── Post-Incident Updates
└── Lessons Learned
```

---

## Key Tables

| Table | Label | Key Fields |
|-------|-------|------------|
| sn_bcm_bc_plan | Business Continuity Plan | name, state, owner, business_process, rto, rpo |
| sn_bcm_bia | Business Impact Analysis | process, criticality, rto, rpo, max_tolerable_outage |
| sn_bcm_dr_plan | Disaster Recovery Plan | name, system, rto, rpo, recovery_steps |
| sn_bcm_test_exercise | BCM Test/Exercise | plan, type, date, results, gaps_identified |
| sn_bcm_dependency | Dependency | process, dependent_on, dependency_type, criticality |
| sn_bcm_recovery_resource | Recovery Resource | name, type, location, quantity, plan |

---

## Key Concepts

### RTO vs RPO
- **RTO (Recovery Time Objective)**: Maximum acceptable downtime - how quickly you must recover
- **RPO (Recovery Point Objective)**: Maximum acceptable data loss - how far back you can restore
- **MTPD (Maximum Tolerable Period of Disruption)**: Absolute maximum before business failure
- **MAO (Maximum Acceptable Outage)**: Business-set maximum downtime

### Process Criticality Tiers
| Tier | Name | RTO | RPO |
|------|------|-----|-----|
| 1 | Mission Critical | <1 hour | Near-zero/0 minutes |
| 2 | Critical | <4 hours | <1 hour |
| 3 | Important | <24 hours | <4 hours |
| 4 | Normal | <72 hours | <24 hours |
| 5 | Low | <1 week | <48 hours |

---

## GlideRecord Scripts

### Get All Business Processes by Criticality
```javascript
// Get BIA results sorted by criticality
var gr = new GlideRecord('sn_bcm_bia');
gr.addQuery('active', true);
gr.orderBy('criticality');
gr.query();

gs.log('=== BUSINESS IMPACT ANALYSIS SUMMARY ===');
while (gr.next()) {
    gs.log('Process: ' + gr.business_process.getDisplayValue() +
            ' | Criticality: ' + gr.criticality.getDisplayValue() +
            ' | RTO: ' + gr.rto + ' hrs' +
            ' | RPO: ' + gr.rpo + ' hrs' +
            ' | MTPD: ' + gr.max_tolerable_outage + ' hrs' +
            ' | Owner: ' + gr.process_owner.getDisplayValue());
}
```

### Find BCP Plans Due for Review
```javascript
// Find BCPs that haven't been reviewed in the past year
var gr = new GlideRecord('sn_bcm_bc_plan');
gr.addQuery('state', 'approved');
gr.addQuery('last_reviewed', '<', gs.daysAgo(365));
gr.query();

gs.log('=== BCPs OVERDUE FOR REVIEW ===');
while (gr.next()) {
    var daysSinceReview = Math.round((new Date() - new Date(gr.last_reviewed)) / (1000 * 60 * 60 * 24));
    gs.log('BCP: ' + gr.name +
            ' | Owner: ' + gr.owner.getDisplayValue() +
            ' | Last Reviewed: ' + gr.last_reviewed +
            ' | Days Since Review: ' + daysSinceReview);
}
```

### BCM Test Coverage Report
```javascript
// Check which plans have been tested in the current year
var currentYear = new Date().getFullYear();
var yearStart = currentYear + '-01-01';

var plans = new GlideRecord('sn_bcm_bc_plan');
plans.addQuery('state', 'approved');
plans.addQuery('active', true);
plans.query();

gs.log('=== BCM TEST COVERAGE ===');
var tested = 0, untested = 0;

while (plans.next()) {
    var exercise = new GlideRecord('sn_bcm_test_exercise');
    exercise.addQuery('plan', plans.sys_id);
    exercise.addQuery('date', '>=', yearStart);
    exercise.setLimit(1);
    exercise.query();
    
    if (exercise.next()) {
        tested++;
        gs.log('[TESTED] ' + plans.name + ' | Last Test: ' + exercise.date + ' | Result: ' + exercise.result.getDisplayValue());
    } else {
        untested++;
        gs.log('[NOT TESTED] ' + plans.name + ' | Owner: ' + plans.owner.getDisplayValue());
    }
}

gs.log('Coverage: ' + tested + '/' + (tested + untested) + ' plans tested (' + 
        Math.round(tested / (tested + untested) * 100) + '%)');
```

### RTO/RPO Gap Analysis
```javascript
// Compare BIA requirements vs actual DR capabilities
var gr = new GlideRecord('sn_bcm_bia');
gr.addQuery('criticality', 'IN', 'tier_1,tier_2'); // Focus on critical processes
gr.query();

gs.log('=== RTO/RPO GAP ANALYSIS ===');
while (gr.next()) {
    // Find associated DR plan
    var dr = new GlideRecord('sn_bcm_dr_plan');
    dr.addQuery('business_process', gr.business_process);
    dr.setLimit(1);
    dr.query();
    
    if (dr.next()) {
        var rtoGap = parseInt(gr.rto) - parseInt(dr.actual_rto);
        var rpoGap = parseInt(gr.rpo) - parseInt(dr.actual_rpo);
        
        var status = (rtoGap >= 0 && rpoGap >= 0) ? 'MEETS REQUIREMENT' : 'GAP IDENTIFIED';
        
        gs.log(status + ' | Process: ' + gr.business_process.getDisplayValue() +
                ' | Required RTO: ' + gr.rto + 'h | Actual RTO: ' + dr.actual_rto + 'h' +
                ' | Required RPO: ' + gr.rpo + 'h | Actual RPO: ' + dr.actual_rpo + 'h');
    } else {
        gs.log('NO DR PLAN - Process: ' + gr.business_process.getDisplayValue() +
                ' | Criticality: ' + gr.criticality.getDisplayValue());
    }
}
```

### Create BCP Exercise/Test Record
```javascript
// Create a BCM test exercise record
function createBCMExercise(planSysId, exerciseType, scheduledDate) {
    var exercise = new GlideRecord('sn_bcm_test_exercise');
    exercise.initialize();
    exercise.plan = planSysId;
    exercise.type = exerciseType; // tabletop, simulation, full_test
    exercise.state = 'scheduled';
    exercise.date = scheduledDate;
    exercise.coordinator = gs.getUserID();
    exercise.insert();
    
    gs.log('BCM Exercise created: ' + exercise.number + ' | Type: ' + exerciseType + ' | Date: ' + scheduledDate);
    return exercise.sys_id;
}
```

---

## Encoded Queries

### All Critical Process BCPs Not Tested This Year
```
bia.criticality=tier_1^last_test_dateLT2026-01-01^ORlast_test_dateISEMPTY
```

### BCPs with Identified Gaps
```
state=approved^gaps_identified=true^state!=closed
```

---

## Key Metrics

| Metric | Target |
|--------|--------|
| BCP Test Coverage (Critical Processes) | 100% annually |
| BCP Review Currency | 100% reviewed within 12 months |
| RTO Compliance Rate | ≥90% meet stated RTO |
| RPO Compliance Rate | ≥90% meet stated RPO |
| BIA Coverage | 100% of critical processes |
| Recovery Exercise Success Rate | ≥90% successful |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
