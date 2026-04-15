# ServiceNow IRM - Risk Management Workflow Templates

> **Module:** Risk Management | **Version:** 2.0 | **Author:** Ankit Uniyal

## Overview

This guide provides Flow Designer and Workflow templates for automating Risk Management processes in ServiceNow IRM.

---

## 1. Risk Identification & Creation Workflow

### Flow: New Risk Intake Process
```
Trigger: Record Created on [sn_risk_risk]
Actions:
  1. Set State = "Draft"
  2. Send acknowledgment email to Risk Submitter
  3. Create Risk Assessment Task
  4. Assign to Risk Owner (based on Category mapping)
  5. Set Review Date = Today + 30 days
  6. Notify Risk Manager via email
  7. Log activity entry
```

### Flow Designer Script (Subflow - Risk Assignment):
```javascript
// Subflow: Auto-assign risk based on category
(function assignRiskByCategory(risk_sys_id) {
    var riskGr = new GlideRecord('sn_risk_risk');
    if (!riskGr.get(risk_sys_id)) return;
    
    // Category-to-Owner mapping
    var categoryOwnerMap = {
        'operational': gs.getProperty('sn_risk.operational_risk_owner'),
        'financial': gs.getProperty('sn_risk.financial_risk_owner'),
        'cyber': gs.getProperty('sn_risk.cyber_risk_owner'),
        'compliance': gs.getProperty('sn_risk.compliance_risk_owner'),
        'strategic': gs.getProperty('sn_risk.strategic_risk_owner')
    };
    
    var category = riskGr.getValue('category');
    var ownerSysId = categoryOwnerMap[category];
    
    if (ownerSysId) {
        riskGr.setValue('owned_by', ownerSysId);
        riskGr.update();
        gs.info('Risk ' + riskGr.getValue('number') + ' assigned to category owner: ' + ownerSysId);
    }
})(inputs.risk_sys_id);
```

---

## 2. Risk Assessment Workflow

### Flow: Risk Assessment Execution
```
Trigger: Field Change on [sn_risk_risk] where state changes to "In Assessment"
Actions:
  1. Create Risk Assessment record (sn_risk_risk_assessment)
  2. Spawn Assessment Tasks for each assessment question
  3. Set Assessment Due Date = Today + 14 days
  4. Send task assignments to assessors
  5. Schedule reminder at Due Date - 3 days
  6. On Assessment Completion:
     a. Calculate Inherent Risk Score (Likelihood x Impact)
     b. Calculate Residual Risk (apply control effectiveness)
     c. Update Risk Rating
     d. Set State = "Awaiting Approval"
```

### Risk Scoring Script:
```javascript
// Calculate and update risk scores in Flow Designer
var risk = current; // Risk record
var likelihood = parseInt(risk.getValue('likelihood') || '1');
var impact = parseInt(risk.getValue('impact') || '1');
var inherentScore = likelihood * impact;
var controlEffectiveness = parseFloat(risk.getValue('control_effectiveness') || '0');
var residualScore = inherentScore * (1 - (controlEffectiveness / 100));

risk.setValue('inherent_risk_score', inherentScore);
risk.setValue('risk_score', Math.round(residualScore * 100) / 100);

var rating = residualScore >= 16 ? 'critical' :
             residualScore >= 9  ? 'high' :
             residualScore >= 4  ? 'medium' : 'low';
risk.setValue('risk_rating', rating);
```

---

## 3. Risk Treatment Workflow

### Flow: Risk Treatment Plan Approval
```
Trigger: Field Change on [sn_risk_risk] where treatment_type is set
Actions:
  1. Create Treatment Plan record
  2. If treatment_type = 'accept':
     - Route to Risk Owner for formal acceptance
     - Set acceptance expiry = Today + 365 days
     - Notify Risk Manager
  3. If treatment_type = 'mitigate':
     - Create Remediation Tasks
     - Assign to Control Owner
     - Set target completion date
     - Link to existing or new Controls
  4. If treatment_type = 'transfer':
     - Route to Insurance/Legal team
     - Create vendor/insurance record linkage
  5. If treatment_type = 'avoid':
     - Route to Executive Sponsor for approval
     - Document avoidance strategy
  6. Set State = "Treatment in Progress"
```

---

## 4. Risk Review & Monitoring Workflow

### Scheduled Flow: Periodic Risk Review
```
Trigger: Scheduled (runs daily at 06:00)
Actions:
  1. Query risks where review_date <= Today
  2. For each overdue risk:
     a. Send reminder to Risk Owner
     b. Escalate if overdue > 7 days (notify Risk Manager)
     c. Escalate if overdue > 14 days (notify CISO/CRO)
  3. Update KRI metrics
  4. Generate daily risk summary email for Risk Manager
```

### Escalation Script:
```javascript
// Risk review escalation logic
var RiskReviewEscalator = {
    run: function() {
        var now = new GlideDateTime();
        var d7 = new GlideDateTime(); d7.addDaysLocalTime(-7);
        var d14 = new GlideDateTime(); d14.addDaysLocalTime(-14);
        
        var gr = new GlideRecord('sn_risk_risk');
        gr.addQuery('state', 'open');
        gr.addQuery('review_date', '<', now.getValue());
        gr.addQuery('active', true);
        gr.query();
        
        while (gr.next()) {
            var reviewDate = gr.getGlideObject('review_date');
            if (reviewDate.compareTo(d14) < 0) {
                this.escalateLevel2(gr);
            } else if (reviewDate.compareTo(d7) < 0) {
                this.escalateLevel1(gr);
            } else {
                this.sendReminder(gr);
            }
        }
    },
    
    sendReminder: function(gr) {
        gs.eventQueue('sn_risk.review.reminder', gr, gr.getDisplayValue('owned_by'), gr.getValue('review_date'));
    },
    
    escalateLevel1: function(gr) {
        gs.eventQueue('sn_risk.review.escalation.l1', gr, gr.getDisplayValue('owned_by'), '7 days overdue');
        gs.info('Risk Escalation L1: ' + gr.getValue('number'));
    },
    
    escalateLevel2: function(gr) {
        gs.eventQueue('sn_risk.review.escalation.l2', gr, gs.getProperty('sn_risk.cro_user'), '14 days overdue');
        gs.info('Risk Escalation L2: ' + gr.getValue('number'));
    }
};
RiskReviewEscalator.run();
```

---

## 5. Risk Closure Workflow

### Flow: Risk Closure Process
```
Trigger: State changes to "Closed" on [sn_risk_risk]
Actions:
  1. Validate all treatment tasks are complete
  2. Require mandatory closure comments
  3. Send closure notification to Risk Owner and Stakeholders
  4. Update Risk Register statistics
  5. Archive risk with final scores
  6. Update related control effectiveness records
  7. Log closure to audit trail
```

---

## 6. KRI Breach Response Workflow

### Flow: KRI Threshold Breach Alert
```
Trigger: Field Change on [sn_risk_kri_metric] where status changes to 'red'
Actions:
  1. Immediately notify KRI Owner
  2. Create Incident/Issue record linked to KRI
  3. Notify Risk Manager within 1 hour
  4. Notify CISO/CRO if breach persists > 24 hours
  5. Schedule KRI review meeting
  6. Log breach to risk register
  7. Update dashboard indicators
```

---

## 7. Risk Appetite Review Workflow

### Scheduled Flow: Quarterly Risk Appetite Review
```
Trigger: Scheduled - First Monday of each quarter
Actions:
  1. Generate Risk Appetite vs. Actual report
  2. Identify risks exceeding appetite thresholds
  3. Create review tasks for Risk Committee
  4. Compile board risk report
  5. Schedule Risk Committee meeting
  6. Send agenda to Risk Committee members
```

---

## Business Rule Templates for Risk Module

### BR-001: Set Risk Score on Assessment Complete
```javascript
// Business Rule: sn_risk_risk | Before | Insert/Update
// Condition: current.state.changesTo('assessed')
if (current.state.changesTo('assessed') || 
    current.likelihood.changes() || 
    current.impact.changes()) {
    
    var likelihood = parseInt(current.likelihood.getValue()) || 1;
    var impact = parseInt(current.impact.getValue()) || 1;
    current.inherent_risk_score = likelihood * impact;
    
    var controlEff = parseFloat(current.control_effectiveness.getValue()) || 0;
    var residual = current.inherent_risk_score * (1 - (controlEff / 100));
    current.risk_score = Math.round(residual * 100) / 100;
    
    if (current.risk_score >= 16) current.risk_rating = 'critical';
    else if (current.risk_score >= 9) current.risk_rating = 'high';
    else if (current.risk_score >= 4) current.risk_rating = 'medium';
    else current.risk_rating = 'low';
}
```

### BR-002: Auto-Set Review Date
```javascript
// Business Rule: sn_risk_risk | Before | Insert
// Set initial review date based on risk rating
var reviewMonths = { critical: 1, high: 3, medium: 6, low: 12 };
var rating = current.risk_rating.getValue() || 'medium';
var reviewDate = new GlideDateTime();
reviewDate.addMonthsLocalTime(reviewMonths[rating] || 6);
current.review_date = reviewDate.getValue();
```

---

*ServiceNow IRM Toolkit - Risk Workflow Templates | Version 2.0 | Ankit Uniyal*
