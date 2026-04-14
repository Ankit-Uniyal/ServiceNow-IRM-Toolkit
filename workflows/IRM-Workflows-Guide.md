# 🔀 ServiceNow IRM Workflows & Flow Designer Guide

## Overview
This guide covers all major workflows and Flow Designer flows used across the ServiceNow IRM platform.
Includes step-by-step flow configurations, trigger conditions, and action scripts.

---

## ServiceNow Flow Designer vs Legacy Workflow Editor

| Feature | Flow Designer | Legacy Workflow Editor |
|---------|--------------|----------------------|
| Interface | Modern, visual drag-drop | Classic workflow canvas |
| Recommended | Yes (Utah+) | No (deprecated in Xanadu) |
| Reusability | Subflows, Actions | No |
| Best For | All new development | Legacy maintenance only |

---

## 1. RISK MANAGEMENT FLOWS

### Flow: Risk Assessment Approval
**Trigger**: Record Created/Updated on `sn_risk_risk_assessment`
**Condition**: State changes to 'Pending Review'

```
TRIGGER: Record Action
├── Table: sn_risk_risk_assessment
├── Action: Created or Updated
└── Condition: state == pending_review

FLOW STEPS:
Step 1: Get Risk Record
├── Action: Look Up Records
├── Table: sn_risk_risk

Step 2: Determine Approver Based on Score
├── Critical (16-25): CISO - SLA 24 hrs
├── High (10-15): Risk Manager - SLA 48 hrs
└── Medium/Low: Risk Owner Manager - SLA 72 hrs

Step 3: Request Approval (Ask for Approval action)

Step 4a: IF APPROVED: state = approved
Step 4b: IF REJECTED: state = rejected + comments

Step 5: Send Notification to Assessor
```

### Flow: KRI Threshold Breach Alert
**Trigger**: Record Updated on `sn_risk_kri`
**Condition**: threshold_breach changes to true

```
TRIGGER: sn_risk_kri updated, threshold_breach = true

Step 1: Get Risk Record associated with KRI
Step 2: Determine notification group based on risk score
Step 3: Create Response Task (due: 24 hours)
Step 4: Send Alert Notification to Risk Team
Step 5: If Critical Risk - Notify Executive Team
```

---

## 2. COMPLIANCE MANAGEMENT FLOWS

### Flow: Policy Approval Workflow
**Trigger**: State changes to In Review on `sn_compliance_policy`

```
FLOW STEPS:
Step 1: Legal Review (5 business days)
Step 2: Compliance Team Review (3 business days)
Step 3: Executive Approval - CISO/CRO (5 business days)

IF ALL APPROVED:
- Set state = published
- Create attestation records for all in-scope users
- Send publication notification

IF REJECTED:
- Set state = draft
- Add rejection notes
- Notify policy owner
```

### Flow: Control Test Failure to Finding
**Trigger**: Record Created on `sn_compliance_test_result` where result = fail

```
Step 1: Look up Control details
Step 2: Determine Finding severity based on control type + risk score
Step 3: Create sn_compliance_finding record
Step 4: Notify Control Owner
Step 5: If Critical - Escalate to CISO
```

---

## 3. AUDIT MANAGEMENT FLOWS

### Flow: Audit Engagement Lifecycle
```
PLANNING PHASE:
1. Send engagement letter to auditee
2. Create audit program tasks from template
3. Schedule kickoff meeting

FIELDWORK PHASE:
4. Weekly status update to sponsor
5. Alert on overdue tasks (3+ days)

REPORTING PHASE:
6. Request management responses (5 business days)
7. Distribute final report to audit committee

CLOSURE PHASE:
8. Set 30/60/90 day finding follow-ups
```

### Flow: Critical Finding Escalation
**Trigger**: Finding created/updated with severity = critical

```
Step 1: Immediate email to CAE
Step 2: Create 24-hour task for Lead Auditor
Step 3: Auto-create risk in Risk Register
Step 4: Audit Committee notification within 24 hours
```

---

## 4. VENDOR RISK FLOWS

### Flow: Vendor Onboarding
```
Step 1: Sanctions screening via API
Step 2: Assign risk tier (1-4) based on criteria
Step 3: Select assessment template based on tier
Step 4: Send assessment portal link to vendor
Step 5: Follow-up reminders: Day 15, 25, 30
Step 6: Review completed assessment
Step 7: Approve/Reject vendor onboarding
```

---

## 5. KEY FLOW DESIGNER SCRIPTS

### Script: Calculate Residual Risk Score
```javascript
// Used in subflow to calculate residual score based on control effectiveness
function calculateResidualScore(riskSysId) {
    var risk = new GlideRecord('sn_risk_risk');
    if (!risk.get(riskSysId)) return { residualScore: 0, rating: 'unknown' };
    
    var inherentScore = parseInt(risk.inherent_score);
    var controls = new GlideRecord('sn_risk_m2m_risk_control');
    controls.addQuery('risk', riskSysId);
    controls.query();
    
    var totalEff = 0;
    var count = 0;
    var effMap = { 'high': 0.7, 'medium': 0.4, 'low': 0.2, 'none': 0 };
    
    while (controls.next()) {
        totalEff += effMap[controls.control_effectiveness.toString()] || 0.4;
        count++;
    }
    
    var avgEff = count > 0 ? totalEff / count : 0;
    var residualScore = Math.round(inherentScore * (1 - avgEff));
    
    var rating;
    if (residualScore >= 16) rating = 'critical';
    else if (residualScore >= 10) rating = 'high';
    else if (residualScore >= 5) rating = 'medium';
    else rating = 'low';
    
    risk.residual_score = residualScore;
    risk.residual_rating = rating;
    risk.update();
    
    return { residualScore: residualScore, rating: rating };
}
```

### Script: Auto-Assign Approver for Risk
```javascript
// Determine approver based on risk score and category
function getApproverForRisk(riskScore, riskCategory) {
    var approver = null;
    var slaHours = 48;
    
    if (riskScore >= 16) {
        // Critical - CISO
        var cisoGroup = new GlideRecord('sys_user_group');
        cisoGroup.addQuery('name', 'CISO Office');
        cisoGroup.setLimit(1);
        cisoGroup.query();
        if (cisoGroup.next()) {
            approver = cisoGroup.manager;
            slaHours = 24;
        }
    } else if (riskScore >= 10) {
        // High - Risk Manager
        var riskGroup = new GlideRecord('sys_user_group');
        riskGroup.addQuery('name', 'Risk Management');
        riskGroup.setLimit(1);
        riskGroup.query();
        if (riskGroup.next()) {
            approver = riskGroup.manager;
            slaHours = 48;
        }
    }
    
    return { approver: approver, slaHours: slaHours };
}
```

---

## 6. INTEGRATION HUB SPOKES

| Spoke | Use Case | Flow |
|-------|----------|------|
| Email | Notifications for all IRM events | All flows |
| ServiceNow | Cross-module lookups | Risk to Audit |
| REST | KRI data from external systems | KRI monitoring |
| Teams/Slack | Real-time alerts for critical events | Escalations |
| Excel/CSV | Bulk data import | Risk/Audit import |
| JIRA | Sync findings to engineering | Audit to Dev |
| DocuSign | Policy attestation signatures | Policy approval |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../README.md)*
