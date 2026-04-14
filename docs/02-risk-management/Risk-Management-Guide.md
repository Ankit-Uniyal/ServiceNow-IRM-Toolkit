# ⚠️ Risk Management Module - Complete Guide

## Overview
ServiceNow Risk Management (RM) provides a comprehensive platform for identifying, assessing, treating, and monitoring enterprise risks. It serves as the System of Record (SoR) for all organizational risks aligned to frameworks like ISO 31000, COSO ERM, and NIST RMF.

---

## Core Concepts

### Risk Taxonomy
```
Enterprise Risk
├── Strategic Risk
│   ├── Market Risk
│   ├── Competitive Risk
│   └── Reputation Risk
├── Operational Risk
│   ├── IT/Technology Risk
│   ├── Process Risk
│   └── People Risk
├── Financial Risk
│   ├── Credit Risk
│   ├── Liquidity Risk
│   └── Market/FX Risk
├── Compliance/Legal Risk
│   ├── Regulatory Risk
│   └── Legal/Litigation Risk
└── Cybersecurity Risk
    ├── Data Breach Risk
    ├── Ransomware Risk
    └── Third-Party Risk
```

### Risk Scoring Model
ServiceNow uses a **5x5 Risk Matrix** by default:

| Likelihood \ Impact | 1-Insignificant | 2-Minor | 3-Moderate | 4-Major | 5-Catastrophic |
|---------------------|-----------------|---------|------------|---------|----------------|
| 5-Almost Certain    | 5 (Medium)      | 10 (High) | 15 (High) | 20 (Critical) | 25 (Critical) |
| 4-Likely            | 4 (Low)         | 8 (Medium) | 12 (High) | 16 (Critical) | 20 (Critical) |
| 3-Possible          | 3 (Low)         | 6 (Medium) | 9 (Medium) | 12 (High) | 15 (High) |
| 2-Unlikely          | 2 (Low)         | 4 (Low)  | 6 (Medium) | 8 (Medium) | 10 (High) |
| 1-Rare              | 1 (Low)         | 2 (Low)  | 3 (Low)   | 4 (Low)  | 5 (Medium) |

**Risk Rating Thresholds:**
- Critical: 16-25
- High: 10-15
- Medium: 5-9
- Low: 1-4

---

## Key Tables

| Table | Label | Key Fields |
|-------|-------|------------|
| sn_risk_risk | Risk | number, name, category, state, owner, inherent_score, residual_score, risk_appetite |
| sn_risk_risk_assessment | Risk Assessment | risk, assessment_type, state, score, assessor, due_date |
| sn_risk_risk_assessment_task | Assessment Task | assessment, assigned_to, state, due_date |
| sn_risk_risk_statement | Risk Statement | name, description, category, likelihood, impact |
| sn_risk_m2m_risk_control | Risk-Control M2M | risk, control, control_effectiveness |
| sn_risk_risk_response_task | Risk Response Task | risk, response_type, owner, due_date, state |
| sn_risk_definition | Risk Definition | name, description, category, type |
| sn_risk_risk_appetite | Risk Appetite | category, threshold, owner |
| sn_risk_kri | Key Risk Indicator | name, risk, threshold_breach, value, trend |
| sn_risk_advanced_risk_assessment | Advanced Risk Assessment | risk, methodology, quantitative_score |

---

## Risk Lifecycle

### Stage 1: Risk Identification
```
Identify Risk → Assign Category → Select Risk Statement →
Set Initial Inherent Score → Assign Risk Owner
```

### Stage 2: Risk Assessment
```
Create Assessment → Assign Tasks to SMEs →
Collect Likelihood/Impact Scores → Calculate Inherent Score →
Review Control Effectiveness → Calculate Residual Score
```

### Stage 3: Risk Treatment
```
Review Residual Score vs Risk Appetite →
Select Treatment Strategy (4 T's):
  ├── TOLERATE: Accept if within appetite
  ├── TREAT: Mitigate with controls
  ├── TRANSFER: Insurance/outsource
  └── TERMINATE: Stop the activity
→ Create Response Tasks → Monitor
```

### Stage 4: Risk Monitoring
```
Set KRIs → Monitor KRI thresholds →
Periodic re-assessment → Report to board/exec
```

---

## GlideRecord Scripts

### Get All High/Critical Risks
```javascript
// Query all high and critical residual risks
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('residual_score', '>=', 10); // High and above
gr.orderByDesc('residual_score');
gr.query();

gs.log('=== HIGH/CRITICAL RISKS ===');
while (gr.next()) {
    gs.log('Risk: ' + gr.number + 
            ' | Name: ' + gr.name +
            ' | Residual Score: ' + gr.residual_score +
            ' | Owner: ' + gr.owner.getDisplayValue() +
            ' | Category: ' + gr.category.getDisplayValue());
}
```

### Risk Heat Map Data Query
```javascript
// Generate risk heat map data
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('active', true);
gr.query();

var heatMap = {};
while (gr.next()) {
    var likelihood = gr.likelihood.toString();
    var impact = gr.impact.toString();
    var key = likelihood + 'x' + impact;
    
    if (!heatMap[key]) {
        heatMap[key] = { count: 0, risks: [] };
    }
    heatMap[key].count++;
    heatMap[key].risks.push(gr.number + ' - ' + gr.name);
}

gs.log('Risk Heat Map Distribution:');
for (var cell in heatMap) {
    gs.log('  Cell ' + cell + ': ' + heatMap[cell].count + ' risks');
}
```

### Find Risks Exceeding Risk Appetite
```javascript
// Find risks where residual score exceeds defined risk appetite
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('active', true);
gr.query();

while (gr.next()) {
    // Get risk appetite for this category
    var appetite = new GlideRecord('sn_risk_risk_appetite');
    appetite.addQuery('category', gr.category);
    appetite.query();
    
    if (appetite.next()) {
        var threshold = parseInt(appetite.threshold);
        var residual = parseInt(gr.residual_score);
        
        if (residual > threshold) {
            gs.log('EXCEEDS APPETITE - Risk: ' + gr.number +
                    ' | Residual: ' + residual +
                    ' | Appetite Threshold: ' + threshold +
                    ' | Category: ' + gr.category.getDisplayValue());
        }
    }
}
```

### Get Risks by Owner
```javascript
// Get all open risks grouped by owner
var gr = new GlideAggregate('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addAggregate('COUNT', 'owner');
gr.groupBy('owner');
gr.orderByAggregate('COUNT', 'owner');
gr.query();

gs.log('=== RISK COUNT BY OWNER ===');
while (gr.next()) {
    var ownerName = gr.owner.getDisplayValue();
    var count = gr.getAggregate('COUNT', 'owner');
    gs.log('Owner: ' + ownerName + ' | Open Risks: ' + count);
}
```

### Create Risk with Full Details
```javascript
// Create a new risk record programmatically
function createRisk(riskData) {
    var risk = new GlideRecord('sn_risk_risk');
    risk.initialize();
    
    risk.name = riskData.name;
    risk.description = riskData.description;
    risk.category = riskData.category; // sys_id or choice value
    risk.owner = riskData.ownerSysId;
    risk.state = 'open';
    risk.likelihood = riskData.likelihood; // 1-5
    risk.impact = riskData.impact; // 1-5
    risk.inherent_score = riskData.likelihood * riskData.impact;
    
    var sysId = risk.insert();
    gs.log('Created Risk: ' + risk.number + ' with sys_id: ' + sysId);
    return sysId;
}

// Example usage:
createRisk({
    name: 'Data Breach via Phishing Attack',
    description: 'Risk of sensitive data exposure through successful phishing attacks on employees',
    category: 'cybersecurity', // use correct choice value from your instance
    ownerSysId: 'CISO_SYS_ID_HERE', // replace with actual sys_id
    likelihood: 4,
    impact: 5
});
```

### Risk Assessment Completion Status
```javascript
// Check risk assessment completion status
var gr = new GlideRecord('sn_risk_risk_assessment');
gr.addQuery('state', '!=', 'closed');
gr.addQuery('due_date', '<', gs.nowDateTime()); // Overdue
gr.orderBy('due_date');
gr.query();

gs.log('=== OVERDUE RISK ASSESSMENTS ===');
while (gr.next()) {
    gs.log('Assessment: ' + gr.number +
            ' | Risk: ' + gr.risk.getDisplayValue() +
            ' | Due: ' + gr.due_date +
            ' | State: ' + gr.state.getDisplayValue() +
            ' | Assessor: ' + gr.assessor.getDisplayValue());
}
```

### Key Risk Indicator (KRI) Breach Check
```javascript
// Find all KRIs that have breached their thresholds
var gr = new GlideRecord('sn_risk_kri');
gr.addQuery('active', true);
gr.query();

gs.log('=== KRI THRESHOLD BREACHES ===');
while (gr.next()) {
    var currentValue = parseFloat(gr.value);
    var threshold = parseFloat(gr.threshold);
    var direction = gr.threshold_direction.toString(); // 'above' or 'below'
    
    var breached = (direction === 'above' && currentValue > threshold) ||
                   (direction === 'below' && currentValue < threshold);
    
    if (breached) {
        gs.log('KRI BREACH: ' + gr.name +
                ' | Current Value: ' + currentValue +
                ' | Threshold: ' + threshold +
                ' | Risk: ' + gr.risk.getDisplayValue());
    }
}
```

### Monte Carlo Risk Quantification (Quantitative)
```javascript
// Simplified quantitative risk calculation
// For advanced quantitative risk assessment

function calculateQuantitativeRisk(annualEventProbability, singleLossExpectancy) {
    // ALE = ARO × SLE
    var annualLossExpectancy = annualEventProbability * singleLossExpectancy;
    
    // Monte Carlo simulation (simplified, 1000 iterations)
    var simulations = 1000;
    var results = [];
    
    for (var i = 0; i < simulations; i++) {
        var random = Math.random();
        if (random <= annualEventProbability) {
            // Event occurs - vary the impact by ±30%
            var variation = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
            results.push(singleLossExpectancy * variation);
        } else {
            results.push(0);
        }
    }
    
    // Sort and find percentiles
    results.sort(function(a, b) { return a - b; });
    var p95 = results[Math.floor(simulations * 0.95)];
    var p99 = results[Math.floor(simulations * 0.99)];
    
    return {
        ale: annualLossExpectancy,
        p95: p95,
        p99: p99,
        averageLoss: results.reduce(function(a, b) { return a + b; }, 0) / simulations
    };
}

// Example: Ransomware risk
var result = calculateQuantitativeRisk(0.3, 2000000); // 30% probability, $2M impact
gs.log('ALE: $' + result.ale.toLocaleString());
gs.log('95th percentile: $' + result.p95.toLocaleString());
gs.log('99th percentile: $' + result.p99.toLocaleString());
```

### Link Controls to Risks
```javascript
// Associate a control with a risk (M2M mapping)
function linkControlToRisk(riskSysId, controlSysId, effectiveness) {
    // Check if mapping already exists
    var existing = new GlideRecord('sn_risk_m2m_risk_control');
    existing.addQuery('risk', riskSysId);
    existing.addQuery('control', controlSysId);
    existing.query();
    
    if (!existing.hasNext()) {
        var m2m = new GlideRecord('sn_risk_m2m_risk_control');
        m2m.risk = riskSysId;
        m2m.control = controlSysId;
        m2m.control_effectiveness = effectiveness; // 'high', 'medium', 'low'
        m2m.insert();
        gs.log('Linked control to risk successfully');
        return true;
    } else {
        gs.log('Mapping already exists');
        return false;
    }
}
```

### Bulk Risk Import from CSV (Transform Map Logic)
```javascript
// Transform Map Script for bulk risk import
// Used in Import Set Transform Maps

(function transformEntry(source, map, log, target) {
    
    // Map fields from import set to risk table
    target.name = source.u_risk_name;
    target.description = source.u_risk_description;
    target.state = 'open';
    target.active = true;
    
    // Map category
    var catMap = {
        'IT': 'technology',
        'Cyber': 'cybersecurity',
        'Ops': 'operational',
        'Legal': 'compliance'
    };
    target.category = catMap[source.u_category] || 'operational';
    
    // Map likelihood (convert text to number)
    var likMap = {'Rare':1, 'Unlikely':2, 'Possible':3, 'Likely':4, 'AlmostCertain':5};
    target.likelihood = likMap[source.u_likelihood] || 3;
    
    // Map impact (convert text to number)
    var impMap = {'Insignificant':1, 'Minor':2, 'Moderate':3, 'Major':4, 'Catastrophic':5};
    target.impact = impMap[source.u_impact] || 3;
    
    // Calculate inherent score
    target.inherent_score = parseInt(target.likelihood) * parseInt(target.impact);
    
    // Find and set owner by email
    if (source.u_owner_email) {
        var user = new GlideRecord('sys_user');
        user.addQuery('email', source.u_owner_email);
        user.setLimit(1);
        user.query();
        if (user.next()) {
            target.owner = user.sys_id;
        }
    }
    
})(source, map, log, target);
```

---

## Encoded Queries for Risk Reports

### Open Critical Risks
```
state=open^residual_score>=16^active=true
```

### Risks Without Controls
```
state=open^sys_idNOT INjavascript:new GlideAggregate('sn_risk_m2m_risk_control').addAggregate('risk')
```

### Risks Pending Annual Review (Not assessed in 12 months)
```
state=open^last_assessed_onRELATIVELE@year@ago@1
```

### Risks Owned by Inactive Users
```
owner.active=false^state=open
```

---

## Scheduled Jobs

### Monthly Risk Summary Report
```javascript
// Scheduled: 1st of every month
var categories = ['cybersecurity', 'operational', 'compliance', 'technology', 'strategic'];

gs.log('=== MONTHLY RISK SUMMARY - ' + gs.nowDateTime() + ' ===');

for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    
    var total = new GlideAggregate('sn_risk_risk');
    total.addQuery('state', 'open');
    total.addQuery('category', cat);
    total.addAggregate('COUNT');
    total.query();
    total.next();
    
    var critical = new GlideAggregate('sn_risk_risk');
    critical.addQuery('state', 'open');
    critical.addQuery('category', cat);
    critical.addQuery('residual_score', '>=', 16);
    critical.addAggregate('COUNT');
    critical.query();
    critical.next();
    
    gs.log(cat.toUpperCase() + ': Total=' + total.getAggregate('COUNT') +
            ' | Critical=' + critical.getAggregate('COUNT'));
}
```

### KRI Monitoring Job (Daily)
```javascript
// Daily KRI value update and breach notification
var kri = new GlideRecord('sn_risk_kri');
kri.addQuery('active', true);
kri.query();

while (kri.next()) {
    // Here you'd call your data source to get current KRI value
    // For example, query a metric table or external API
    var currentValue = getKRIValue(kri.data_source); // custom function
    
    kri.previous_value = kri.value;
    kri.value = currentValue;
    
    // Determine trend
    if (currentValue > parseFloat(kri.value)) {
        kri.trend = 'increasing';
    } else if (currentValue < parseFloat(kri.value)) {
        kri.trend = 'decreasing';
    } else {
        kri.trend = 'stable';
    }
    
    kri.last_updated = gs.nowDateTime();
    
    // Check threshold
    if (currentValue > parseFloat(kri.threshold)) {
        kri.threshold_breach = true;
        gs.eventQueue('kri.threshold.breached', kri, kri.risk, kri.name + '');
    } else {
        kri.threshold_breach = false;
    }
    
    kri.update();
}
```

---

## Key Risk Indicators (KRIs) - Examples

| KRI Name | Data Source | Threshold | Frequency |
|----------|-------------|-----------|-----------|
| Number of Critical Vulnerabilities | Vulnerability Mgmt | >50 | Daily |
| Failed Login Attempts | SIEM | >1000/day | Daily |
| Patch Compliance Rate | CMDB | <80% | Weekly |
| Data Loss Events | DLP Tool | >0 | Real-time |
| Vendor Risk Assessments Overdue | VRM Module | >10% | Weekly |
| Policy Exceptions Open | PCM Module | >20 | Weekly |
| Audit Findings Overdue | Audit Module | >5 | Weekly |
| Business Continuity Tests | BCM Module | <2/year | Monthly |

---

## Integration with Other Modules

### Risk → Audit
When a risk is rated Critical, auto-trigger an audit:
```javascript
// Business Rule: After Update on sn_risk_risk
// Condition: current.residual_score >= 16 && previous.residual_score < 16

if (current.residual_score >= 16 && previous.residual_score < 16) {
    // Create audit request
    var audit = new GlideRecord('sn_audit_audit');
    audit.initialize();
    audit.name = 'Risk-Driven Audit: ' + current.name;
    audit.description = 'Auto-triggered audit for critical risk: ' + current.number;
    audit.risk = current.sys_id;
    audit.state = 'draft';
    audit.priority = 'high';
    audit.insert();
    gs.log('Auto-created audit for critical risk: ' + current.number);
}
```

### Risk → Vendor Risk
```javascript
// Find all risks associated with vendor assessments
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('category', 'vendor'); // or third_party
gr.addQuery('state', 'open');
gr.query();

while (gr.next()) {
    gs.log('Vendor Risk: ' + gr.number + ' - ' + gr.name +
            ' | Vendor: ' + gr.vendor.getDisplayValue());
}
```

---

## Risk Reporting Queries

### Top 10 Risks by Residual Score
```javascript
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('active', true);
gr.orderByDesc('residual_score');
gr.setLimit(10);
gr.query();

var risks = [];
while (gr.next()) {
    risks.push({
        number: gr.number + '',
        name: gr.name + '',
        residualScore: gr.residual_score + '',
        owner: gr.owner.getDisplayValue(),
        category: gr.category.getDisplayValue()
    });
}
JSON.stringify(risks, null, 2);
```

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
