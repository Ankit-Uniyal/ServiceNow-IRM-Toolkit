# 🏢 Vendor Risk Management (VRM) - Complete Guide

## Overview
ServiceNow VRM provides systematic management of third-party and vendor risks through structured onboarding, tiered risk classification, assessment questionnaires, continuous monitoring, and contract-integrated risk management.

---

## Core Concepts

### Vendor Risk Tiering
| Tier | Criteria | Assessment Frequency | Review Required |
|------|----------|---------------------|-----------------|
| Tier 1 - Critical | Access to critical data, core business functions | Annual + Continuous | CISO + Legal |
| Tier 2 - High | Access to sensitive data, important processes | Annual | Risk Manager |
| Tier 3 - Medium | Limited data access, non-critical processes | Bi-annual | Procurement |
| Tier 4 - Low | No data access, commoditized services | Every 3 years | Procurement |

### Third-Party Risk Categories
- **Cybersecurity/IT Risk**: Data access, cloud hosting, SaaS applications
- **Operational Risk**: Critical process dependencies, single-source suppliers
- **Compliance/Legal Risk**: Regulatory violations, contract breaches
- **Reputational Risk**: Vendor conduct, media exposure
- **Financial Risk**: Vendor financial stability, concentration risk
- **Geopolitical Risk**: Country-specific regulatory/political risks

---

## Key Tables

| Table | Label | Key Fields |
|-------|-------|------------|
| sn_vdr_vendor_assessment | Vendor Assessment | vendor, tier, state, score, assessor |
| sn_vdr_vendor_response | Vendor Response | assessment, question, response, score |
| sn_vdr_vendor_profile | Vendor Profile | company, tier, contact, status |
| sn_vdr_assessment_template | Assessment Template | name, category, questions |
| sn_vdr_finding | VRM Finding | assessment, description, severity, remediation_due |
| core_company | Company (Vendor) | name, vendor, customer, contact |
| ast_contract | Contract | vendor, start_date, end_date, value |

---

## VRM Workflow

```
VENDOR ONBOARDING
├── Vendor Registration Request
├── Initial Screening (Sanctions, Blacklists)
├── Risk Tier Assignment
└── Contract Review

INITIAL ASSESSMENT
├── Send Assessment Questionnaire
├── Vendor Completes Assessment
├── Evidence Collection
├── Auditor Review
└── Risk Rating Assignment

ONGOING MONITORING
├── Continuous Risk Signals (news, ratings)
├── Annual Re-assessment
├── KRI Monitoring
└── Incident Tracking

CONTRACT MANAGEMENT
├── Contract Renewal Risk Review
├── Exit Strategy Planning
└── Off-boarding Process
```

---

## GlideRecord Scripts

### Get All Critical Vendors (Tier 1)
```javascript
// Query all Tier 1 critical vendors
var gr = new GlideRecord('sn_vdr_vendor_profile');
gr.addQuery('tier', 'tier_1');
gr.addQuery('status', 'active');
gr.orderBy('company.name');
gr.query();

gs.log('=== CRITICAL (TIER 1) VENDORS ===');
while (gr.next()) {
    gs.log('Vendor: ' + gr.company.getDisplayValue() +
            ' | Contact: ' + gr.contact.getDisplayValue() +
            ' | Last Assessment: ' + gr.last_assessed_on +
            ' | Risk Score: ' + gr.risk_score);
}
```

### Find Vendors with Expired Assessments
```javascript
// Find vendors whose assessments are overdue for renewal
var gr = new GlideRecord('sn_vdr_vendor_assessment');
gr.addQuery('state', 'approved');
gr.addQuery('next_assessment_date', '<', gs.nowDateTime());
gr.orderBy('next_assessment_date');
gr.query();

gs.log('=== OVERDUE VENDOR ASSESSMENTS ===');
while (gr.next()) {
    var daysPast = Math.round((new Date() - new Date(gr.next_assessment_date)) / (1000 * 60 * 60 * 24));
    gs.log('Vendor: ' + gr.vendor.getDisplayValue() +
            ' | Assessment: ' + gr.number +
            ' | Was Due: ' + gr.next_assessment_date +
            ' | Days Overdue: ' + daysPast);
}
```

### High-Risk Vendor Assessment Report
```javascript
// Get vendors with high risk scores
var gr = new GlideRecord('sn_vdr_vendor_assessment');
gr.addQuery('state', 'approved');
gr.addQuery('score', '>=', 70); // High risk threshold
gr.orderByDesc('score');
gr.query();

gs.log('=== HIGH RISK VENDORS ===');
while (gr.next()) {
    gs.log('Vendor: ' + gr.vendor.getDisplayValue() +
            ' | Risk Score: ' + gr.score +
            ' | Tier: ' + gr.tier.getDisplayValue() +
            ' | Open Findings: ' + gr.open_finding_count);
}
```

### Send Assessment to Vendor
```javascript
// Trigger vendor assessment questionnaire
function initiateVendorAssessment(vendorSysId, templateSysId) {
    var assessment = new GlideRecord('sn_vdr_vendor_assessment');
    assessment.initialize();
    assessment.vendor = vendorSysId;
    assessment.template = templateSysId;
    assessment.state = 'in_progress';
    assessment.due_date = gs.daysAway(30); // 30 day window
    assessment.assessor = gs.getUserID();
    
    var sysId = assessment.insert();
    
    // Trigger email notification to vendor
    gs.eventQueue('vrm.assessment.sent', assessment, vendorSysId, '');
    
    gs.log('Vendor assessment initiated: ' + assessment.number);
    return sysId;
}
```

### Vendor Risk Dashboard Data
```javascript
// VRM dashboard summary
var dashboard = {};

var tiers = ['tier_1', 'tier_2', 'tier_3', 'tier_4'];
dashboard.vendorsByTier = {};

for (var i = 0; i < tiers.length; i++) {
    var tier = tiers[i];
    var count = new GlideAggregate('sn_vdr_vendor_profile');
    count.addQuery('tier', tier);
    count.addQuery('status', 'active');
    count.addAggregate('COUNT');
    count.query();
    count.next();
    dashboard.vendorsByTier[tier] = parseInt(count.getAggregate('COUNT'));
}

// Assessment status
var pending = new GlideAggregate('sn_vdr_vendor_assessment');
pending.addQuery('state', 'in_progress');
pending.addAggregate('COUNT');
pending.query();
pending.next();
dashboard.pendingAssessments = parseInt(pending.getAggregate('COUNT'));

gs.log('VRM Dashboard: ' + JSON.stringify(dashboard, null, 2));
```

### Contract Expiry Risk Check
```javascript
// Find high-risk vendors with contracts expiring in next 90 days
var gr = new GlideRecord('ast_contract');
gr.addQuery('vendor.active', true);
gr.addQuery('end_date', '<', gs.daysAway(90));
gr.addQuery('end_date', '>', gs.nowDateTime());
gr.addQuery('state', 'active');
gr.orderBy('end_date');
gr.query();

gs.log('=== CONTRACTS EXPIRING WITHIN 90 DAYS ===');
while (gr.next()) {
    // Check vendor tier
    var vendorProfile = new GlideRecord('sn_vdr_vendor_profile');
    vendorProfile.addQuery('company', gr.vendor);
    vendorProfile.setLimit(1);
    vendorProfile.query();
    
    var tier = 'Unknown';
    if (vendorProfile.next()) {
        tier = vendorProfile.tier.getDisplayValue();
    }
    
    gs.log('Contract: ' + gr.number +
            ' | Vendor: ' + gr.vendor.getDisplayValue() +
            ' | Expires: ' + gr.end_date +
            ' | Value: ' + gr.contract_value +
            ' | Tier: ' + tier);
}
```

---

## Assessment Questionnaire Templates

### Information Security Assessment Questions
```javascript
// Standard InfoSec questions for vendor assessment
var securityQuestions = [
    {
        domain: 'Data Protection',
        question: 'Does your organization encrypt data at rest and in transit?',
        evidenceRequired: 'Encryption policy, certificate screenshots',
        weight: 10
    },
    {
        domain: 'Access Control',
        question: 'Do you implement Multi-Factor Authentication (MFA) for all system access?',
        evidenceRequired: 'MFA policy, system screenshots',
        weight: 8
    },
    {
        domain: 'Incident Response',
        question: 'Do you have a documented and tested Incident Response Plan?',
        evidenceRequired: 'IRP document, last test date and results',
        weight: 9
    },
    {
        domain: 'Business Continuity',
        question: 'What is your RTO/RPO for critical systems? Provide last BCP test results.',
        evidenceRequired: 'BCP document, test results from last 12 months',
        weight: 7
    },
    {
        domain: 'Third-Party Management',
        question: 'Do you perform security assessments on your sub-processors?',
        evidenceRequired: 'Vendor management policy, sub-processor list',
        weight: 6
    },
    {
        domain: 'Compliance',
        question: 'What compliance certifications do you hold? (ISO 27001, SOC 2, etc.)',
        evidenceRequired: 'Current certificates',
        weight: 10
    }
];

gs.log('Assessment template has ' + securityQuestions.length + ' questions');
```

---

## Encoded Queries

### Active Critical Vendor Assessments Overdue
```
state=in_progress^due_date<javascript:gs.nowDateTime()^vendor_profile.tier=tier_1
```

### Vendors with High Risk Scores
```
score>=70^state=approved^active=true
```

### Open VRM Findings by Severity
```
state=open^severity=high^ORseverity=critical
```

---

## Key Metrics

| Metric | Target |
|--------|--------|
| Assessment Completion Rate | ≥90% on time |
| Critical Vendor Assessment Coverage | 100% annually |
| High Risk Vendor Mitigation Rate | ≥80% within SLA |
| Vendor Onboarding Assessment Rate | 100% of new vendors |
| Fourth-Party Risk Coverage | ≥60% of Tier 1 vendors |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
