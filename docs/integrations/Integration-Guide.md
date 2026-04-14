# 🔗 ServiceNow IRM Integration Guide

## Overview
This guide covers integration patterns for connecting ServiceNow IRM with external systems
including security tools, compliance platforms, ERP systems, and GRC data providers.

---

## Integration Architecture

```
External Systems ←→ Integration Hub ←→ ServiceNow IRM
     ↓                    ↓                    ↓
  SIEM/SOC           MID Server          Risk Register
  Vuln Mgmt          REST/SOAP           Policy/Control
  HR Systems         File Import         Audit Module
  Vendor Portals     Scripted REST       KRI Data
  ERP/Finance        Email               Vendor Risk
```

---

## 1. REST API Integration

### ServiceNow Table API - Create Risk
```bash
# POST - Create a new risk via REST
curl -X POST \
  'https://INSTANCE.service-now.com/api/now/table/sn_risk_risk' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic BASE64_CREDENTIALS' \
  -d '{
    "name": "API Created Risk - Data Breach",
    "description": "Risk created via REST API integration",
    "category": "cybersecurity",
    "likelihood": "4",
    "impact": "5",
    "state": "open"
  }'
```

### Get All Open Risks via REST
```bash
curl -X GET \
  'https://INSTANCE.service-now.com/api/now/table/sn_risk_risk?sysparm_query=state=open^active=true&sysparm_fields=number,name,residual_score,owner,category&sysparm_limit=100' \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic BASE64_CREDENTIALS'
```

### Update Audit Finding via REST
```bash
curl -X PATCH \
  'https://INSTANCE.service-now.com/api/now/table/sn_audit_finding/SYS_ID' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic BASE64_CREDENTIALS' \
  -d '{
    "state": "in_progress",
    "management_response": "Remediation plan: implement MFA by Q2 2026"
  }'
```

---

## 2. Scripted REST API (Inbound)

### Create Scripted REST API for KRI Updates
```javascript
// Scripted REST API: IRM KRI Updater
// Method: PUT /api/irm/kri/{kriId}/value

(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var kriId = request.pathParams.kriId;
    var body = request.body.data;
    
    if (!kriId || !body.value) {
        response.setStatus(400);
        response.setBody({ error: 'Missing kriId or value parameter' });
        return;
    }
    
    var kri = new GlideRecord('sn_risk_kri');
    if (!kri.get(kriId)) {
        response.setStatus(404);
        response.setBody({ error: 'KRI not found: ' + kriId });
        return;
    }
    
    var previousValue = kri.value.toString();
    kri.previous_value = previousValue;
    kri.value = body.value;
    kri.last_updated = gs.nowDateTime();
    kri.data_source_ref = body.source || 'API';
    
    // Determine trend
    if (parseFloat(body.value) > parseFloat(previousValue)) {
        kri.trend = 'increasing';
    } else if (parseFloat(body.value) < parseFloat(previousValue)) {
        kri.trend = 'decreasing';
    } else {
        kri.trend = 'stable';
    }
    
    // Check threshold
    var threshold = parseFloat(kri.threshold.toString());
    var direction = kri.threshold_direction.toString();
    var newValue = parseFloat(body.value);
    
    if ((direction === 'above_threshold' && newValue > threshold) ||
        (direction === 'below_threshold' && newValue < threshold)) {
        kri.threshold_breach = true;
        gs.eventQueue('sn_risk.kri.threshold_breach', kri, gs.getUserID(), kri.risk + '');
    } else {
        kri.threshold_breach = false;
    }
    
    kri.update();
    
    response.setStatus(200);
    response.setBody({
        success: true,
        kriId: kriId,
        newValue: body.value,
        previousValue: previousValue,
        thresholdBreach: kri.threshold_breach.toString()
    });
    
})(request, response);
```

---

## 3. Integration Hub Flows

### SIEM → ServiceNow Risk Integration
```
TRIGGER: Scheduled (every 4 hours)

STEP 1: REST Step - Call SIEM API
  URL: https://siem.company.com/api/alerts?severity=high&status=open
  Method: GET
  Headers: Authorization: Bearer [token]

STEP 2: For Each - Loop through alerts

STEP 3: Script Step - Check if risk already exists
  var gr = new GlideRecord('sn_risk_risk');
  gr.addQuery('siem_alert_id', fd_data.alert.id);
  gr.query();
  output.riskExists = gr.hasNext();

STEP 4: If NOT exists - Create Risk
  Table: sn_risk_risk
  Fields:
    name: 'SIEM Alert: ' + alert.name
    category: 'cybersecurity'
    likelihood: mapSIEMSeverityToLikelihood(alert.severity)
    impact: mapSIEMSeverityToImpact(alert.severity)
    source: 'SIEM'
    siem_alert_id: alert.id
```

### Vulnerability Scanner → Control Testing Integration
```javascript
// Script to import vulnerability data as failed control tests
function importVulnerabilityScanResults(scanResults) {
    var imported = 0;
    
    for (var i = 0; i < scanResults.vulnerabilities.length; i++) {
        var vuln = scanResults.vulnerabilities[i];
        
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
            // Find related control (patch management, vuln management controls)
            var control = findRelatedControl(vuln.category);
            
            if (control) {
                // Create or update test result
                var testResult = new GlideRecord('sn_compliance_test_result');
                testResult.addQuery('test_plan.control', control);
                testResult.addQuery('tested_on', '>=', gs.daysAgo(7));
                testResult.query();
                
                if (!testResult.hasNext()) {
                    var newResult = new GlideRecord('sn_compliance_test_result');
                    newResult.initialize();
                    newResult.test_plan = getOrCreateTestPlan(control);
                    newResult.result = 'fail';
                    newResult.notes = 'Auto-imported from vulnerability scan. CVE: ' + vuln.cve;
                    newResult.tested_on = gs.nowDateTime();
                    newResult.evidence = JSON.stringify(vuln);
                    newResult.insert();
                    imported++;
                }
            }
        }
    }
    
    gs.log('Imported ' + imported + ' vulnerability findings as control test failures');
    return imported;
}
```

---

## 4. Common Integration Patterns

### Pattern 1: Risk Data from ERP
```javascript
// Import financial risks from SAP/Oracle ERP
// Typically runs monthly via MID Server

function importERPFinancialRisks(erpData) {
    var risksCreated = 0;
    var risksUpdated = 0;
    
    erpData.financialRisks.forEach(function(erpRisk) {
        var gr = new GlideRecord('sn_risk_risk');
        gr.addQuery('external_id', erpRisk.riskId);
        gr.addQuery('source', 'ERP');
        gr.query();
        
        if (gr.next()) {
            // Update existing
            gr.name = erpRisk.name;
            gr.inherent_score = erpRisk.riskScore;
            gr.financial_exposure = erpRisk.exposureAmount;
            gr.last_synced = gs.nowDateTime();
            gr.update();
            risksUpdated++;
        } else {
            // Create new
            var newRisk = new GlideRecord('sn_risk_risk');
            newRisk.initialize();
            newRisk.name = erpRisk.name;
            newRisk.category = 'financial';
            newRisk.external_id = erpRisk.riskId;
            newRisk.source = 'ERP';
            newRisk.inherent_score = erpRisk.riskScore;
            newRisk.state = 'open';
            newRisk.insert();
            risksCreated++;
        }
    });
    
    gs.log('ERP Integration: Created=' + risksCreated + ' Updated=' + risksUpdated);
}
```

---

## 5. ServiceNow IRM REST API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/now/table/sn_risk_risk | GET/POST | Risk register |
| /api/now/table/sn_risk_kri | GET/POST/PATCH | KRI management |
| /api/now/table/sn_compliance_policy | GET/POST | Policies |
| /api/now/table/sn_compliance_control | GET/POST | Controls |
| /api/now/table/sn_audit_finding | GET/POST/PATCH | Findings |
| /api/now/table/sn_audit_audit | GET/POST | Audit engagements |
| /api/now/table/sn_vdr_vendor_assessment | GET/POST | Vendor assessments |
| /api/now/stats/sn_risk_risk | GET | Risk statistics |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
