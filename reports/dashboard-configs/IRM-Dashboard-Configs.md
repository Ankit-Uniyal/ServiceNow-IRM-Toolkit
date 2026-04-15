# ServiceNow IRM - Reports & Dashboard Configuration Guide

> **Module:** Reports & Dashboards | **Version:** 2.0 | **Author:** Ankit Uniyal

## Table of Contents

1. [IRM Executive Dashboard](#1-irm-executive-dashboard)
2. [Risk Management Dashboards](#2-risk-management-dashboards)
3. [Policy & Compliance Dashboards](#3-policy--compliance-dashboards)
4. [Audit Management Dashboards](#4-audit-management-dashboards)
5. [Vendor Risk Management Dashboards](#5-vendor-risk-management-dashboards)
6. [Business Continuity Dashboards](#6-business-continuity-dashboards)
7. [KRI/KPI Report Configurations](#7-krikpi-report-configurations)
8. [GlideRecord Queries for Reports](#8-gliderecord-queries-for-reports)
9. [Scheduled Reports Setup](#9-scheduled-reports-setup)
10. [Dashboard Widget Reference](#10-dashboard-widget-reference)

---

## 1. IRM Executive Dashboard

### Dashboard Overview
The IRM Executive Dashboard provides a unified view of organizational risk posture, compliance status, and audit health for C-suite and Board-level stakeholders.

### Dashboard Layout Configuration

```
Dashboard: IRM Executive Overview
Columns: 3
Refresh Rate: 15 minutes
Role Access: irm_executive_viewer, admin, sn_risk.admin

Widgets:
Row 1:
  [1] Overall Risk Posture Gauge      [2] Compliance Score Donut     [3] Open Audit Findings KPI
  
Row 2:
  [4] Risk Heat Map                   [5] Compliance Trend Line      [6] Top 5 High Risks Table
  
Row 3:
  [7] Vendor Risk Summary             [8] Policy Attestation Status  [9] Upcoming Due Dates List
```

### Widget 1: Overall Risk Posture Gauge

| Property | Value |
|----------|-------|
| Widget Type | Gauge / Dial |
| Table | sn_risk_risk |
| Condition | active=true^state=open |
| Aggregate | COUNT |
| Gauge Ranges | Low: 0-5 (Green), Medium: 6-15 (Yellow), High: 16+ (Red) |
| Drill-down | Risk Register List |

**GlideRecord Query:**
```javascript
// Risk count by rating for gauge widget
var ga = new GlideAggregate('sn_risk_risk');
ga.addQuery('active', true);
ga.addQuery('state', 'open');
ga.groupBy('risk_rating');
ga.addAggregate('COUNT');
ga.query();
var riskCounts = {};
while (ga.next()) {
    riskCounts[ga.getValue('risk_rating')] = ga.getAggregate('COUNT');
}
// Returns: { critical: N, high: N, medium: N, low: N }
```

### Widget 2: Compliance Score Donut Chart

| Property | Value |
|----------|-------|
| Widget Type | Donut / Pie Chart |
| Table | sn_compliance_control |
| Group By | state |
| Conditions | active=true |
| Colors | compliant=Green, non_compliant=Red, in_review=Yellow, not_tested=Grey |

---

## 2. Risk Management Dashboards

### 2.1 Risk Register Dashboard

**Dashboard Name:** Risk Management - Risk Register View  
**Primary Role:** sn_risk.manager, sn_risk.analyst

#### Widgets Configuration

**Risk Heat Map Widget**
```
Type: Heat Map (2D Matrix)
X-Axis: Likelihood (1-5)
Y-Axis: Impact (1-5)
Data Source: sn_risk_risk
Color Zones:
  - Green (Low):    Score 1-3
  - Yellow (Medium): Score 4-9
  - Orange (High):  Score 10-14
  - Red (Critical): Score 15-25
Click Action: Open risk list filtered by clicked zone
```

**Risk by Category Bar Chart**
```
Type: Horizontal Bar Chart
Table: sn_risk_risk
Group By: category
Aggregate: COUNT
Filter: active=true^state=open
Sort: Descending by count
Limit: Top 10 categories
```

**Risk Treatment Status Pie**
```
Type: Pie Chart
Table: sn_risk_risk
Group By: treatment_type
Values: accept, mitigate, transfer, avoid
Filter: active=true^state=open
```

**GlideRecord Queries for Risk Dashboard:**
```javascript
// Risk distribution by category and rating
function getRiskDistributionReport() {
    var report = [];
    var ga = new GlideAggregate('sn_risk_risk');
    ga.addQuery('active', true);
    ga.addQuery('state', 'open');
    ga.groupBy('category');
    ga.groupBy('risk_rating');
    ga.addAggregate('COUNT');
    ga.orderByAggregate('COUNT');
    ga.query();
    while (ga.next()) {
        report.push({
            category: ga.getDisplayValue('category'),
            risk_rating: ga.getDisplayValue('risk_rating'),
            count: parseInt(ga.getAggregate('COUNT'))
        });
    }
    return report;
}

// Top 10 highest scored risks
function getTopRisks(limit) {
    var risks = [];
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('active', true);
    gr.addQuery('state', 'open');
    gr.orderByDesc('risk_score');
    gr.setLimit(limit || 10);
    gr.query();
    while (gr.next()) {
        risks.push({
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            risk_score: gr.getValue('risk_score'),
            risk_rating: gr.getDisplayValue('risk_rating'),
            category: gr.getDisplayValue('category'),
            owner: gr.getDisplayValue('owned_by'),
            treatment: gr.getDisplayValue('treatment_type'),
            review_date: gr.getValue('review_date')
        });
    }
    return risks;
}
```

### 2.2 KRI Dashboard

**Dashboard Name:** Key Risk Indicators - Monitoring  
**Refresh:** Real-time (5 min for critical KRIs)

```
KRI Trend Sparklines: Last 12 months
Threshold Indicators: 
  - Green = Within appetite
  - Amber = Approaching threshold (80% of threshold)
  - Red = Threshold breached
Alert Widget: Count of breached KRIs with drill-down
```

**KRI Report Query:**
```javascript
// Get all KRI metrics with breach status
function getKRIStatusReport() {
    var results = [];
    var gr = new GlideRecord('sn_risk_kri_metric');
    gr.addQuery('active', true);
    gr.orderBy('metric_name');
    gr.query();
    while (gr.next()) {
        var currentValue = parseFloat(gr.getValue('current_value') || '0');
        var threshold = parseFloat(gr.getValue('red_threshold') || '0');
        var warning = parseFloat(gr.getValue('amber_threshold') || '0');
        var higherIsWorse = gr.getValue('direction') !== 'lower_is_worse';
        
        var status = 'green';
        if (higherIsWorse) {
            if (currentValue >= threshold) status = 'red';
            else if (currentValue >= warning) status = 'amber';
        } else {
            if (currentValue <= threshold) status = 'red';
            else if (currentValue <= warning) status = 'amber';
        }
        
        results.push({
            kri_name: gr.getValue('metric_name'),
            current_value: currentValue,
            threshold: threshold,
            warning_threshold: warning,
            status: status,
            last_updated: gr.getValue('last_updated'),
            owner: gr.getDisplayValue('owned_by'),
            trend: gr.getDisplayValue('trend_direction')
        });
    }
    return results;
}
```

---

## 3. Policy & Compliance Dashboards

### 3.1 Compliance Posture Dashboard

**Dashboard Name:** Policy & Compliance Management  
**Audience:** CISO, Compliance Manager, Risk Officer

#### Widget Configurations

**Overall Compliance Score Gauge**
```
Type: Circular Gauge
Source: Calculated field from sn_compliance_control
Formula: (Compliant Controls / Total Controls) * 100
Thresholds: <60=Red, 60-79=Amber, 80-89=Yellow, >=90=Green
Target Line: 90%
```

**Compliance by Framework Radar Chart**
```
Type: Radar / Spider Chart
Frameworks: ISO 27001, SOC 2, GDPR, PCI-DSS, NIST CSF, HIPAA
Source: sn_compliance_control grouped by framework
Value: Compliance percentage per framework
```

**Control Testing Pipeline**
```
Type: Funnel/Stacked Bar
Stages: Scheduled -> In Testing -> Evidence Review -> Complete
Source: sn_compliance_test_plan
Colors: Each stage distinct color
Time Period: Current quarter
```

**GlideRecord Queries for Compliance Dashboard:**
```javascript
// Compliance score by framework
function getComplianceByFramework() {
    var frameworks = {};
    var gr = new GlideRecord('sn_compliance_control');
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        var fw = gr.getDisplayValue('framework') || 'Unspecified';
        if (!frameworks[fw]) frameworks[fw] = { total: 0, compliant: 0 };
        frameworks[fw].total++;
        var state = gr.getValue('state');
        if (state === 'compliant' || state === 'effective') frameworks[fw].compliant++;
    }
    
    return Object.keys(frameworks).map(function(fw) {
        var data = frameworks[fw];
        return {
            framework: fw,
            total: data.total,
            compliant: data.compliant,
            non_compliant: data.total - data.compliant,
            score: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0
        };
    }).sort(function(a, b) { return a.score - b.score; });
}

// Controls due for testing this quarter
function getControlsDueForTesting() {
    var results = [];
    var quarterEnd = new GlideDateTime();
    var month = quarterEnd.getMonthLocalTime();
    var daysToAdd = (3 - (month % 3)) * 30;
    quarterEnd.addDaysLocalTime(daysToAdd);
    
    var gr = new GlideRecord('sn_compliance_test_plan');
    gr.addQuery('state', 'IN', 'scheduled,not_tested');
    gr.addQuery('due_date', '<=', quarterEnd.getValue());
    gr.addQuery('active', true);
    gr.orderBy('due_date');
    gr.query();
    while (gr.next()) {
        results.push({
            sys_id: gr.getUniqueValue(),
            control: gr.getDisplayValue('control'),
            framework: gr.getDisplayValue('framework'),
            due_date: gr.getValue('due_date'),
            assigned_to: gr.getDisplayValue('assigned_to'),
            test_type: gr.getDisplayValue('test_type'),
            frequency: gr.getDisplayValue('test_frequency')
        });
    }
    return results;
}

// Exception aging report
function getExceptionAgingReport() {
    var results = [];
    var now = new GlideDateTime();
    var gr = new GlideRecord('sn_compliance_exception');
    gr.addQuery('state', 'approved');
    gr.addQuery('active', true);
    gr.orderBy('expiration_date');
    gr.query();
    while (gr.next()) {
        var expDate = gr.getGlideObject('expiration_date');
        var daysRemaining = expDate ? Math.ceil(GlideDateTime.subtract(now, expDate).getRoundedDayPart()) * -1 : 999;
        results.push({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            control: gr.getDisplayValue('control'),
            risk_accepted: gr.getValue('risk_accepted'),
            expiration_date: gr.getValue('expiration_date'),
            days_remaining: daysRemaining,
            status: daysRemaining < 0 ? 'expired' : daysRemaining <= 30 ? 'expiring_soon' : 'active',
            owner: gr.getDisplayValue('owned_by')
        });
    }
    return results;
}
```

---

## 4. Audit Management Dashboards

### 4.1 Audit Program Dashboard

**Dashboard Name:** Audit Management - Program Overview  
**Audience:** Chief Audit Executive, Audit Manager

```
Dashboard Widgets:
1. Annual Audit Plan Completion % - Gauge
2. Audit Engagements by Status - Donut Chart
3. Findings by Severity - Bar Chart  
4. Finding Aging - Time Series
5. Recommendation Tracking - Funnel
6. Upcoming Audit Engagements - List
7. Auditable Entity Coverage - Heat Map
8. Resource Utilization - Stacked Bar
```

**GlideRecord Queries for Audit Dashboard:**
```javascript
// Audit plan completion rate
function getAuditPlanCompletionRate(auditYear) {
    var year = auditYear || new GlideDateTime().getYearLocalTime();
    var total = 0;
    var completed = 0;
    
    var gr = new GlideRecord('sn_audit_audit');
    gr.addQuery('audit_year', year);
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        total++;
        var state = gr.getValue('state');
        if (state === 'closed' || state === 'completed') completed++;
    }
    
    return {
        total_planned: total,
        completed: completed,
        in_progress: 0, // calculated similarly
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        audit_year: year
    };
}

// Findings by severity and age
function getFindingsSeverityReport() {
    var results = { critical: [], high: [], medium: [], low: [] };
    var now = new GlideDateTime();
    
    var gr = new GlideRecord('sn_audit_finding');
    gr.addQuery('state', '!=', 'closed');
    gr.addQuery('active', true);
    gr.orderBy('severity');
    gr.query();
    
    while (gr.next()) {
        var severity = gr.getValue('severity') || 'low';
        var openedDate = gr.getGlideObject('sys_created_on');
        var ageInDays = openedDate ? Math.abs(GlideDateTime.subtract(openedDate, now).getRoundedDayPart()) : 0;
        var findingInfo = {
            sys_id: gr.getUniqueValue(),
            short_description: gr.getValue('short_description'),
            severity: gr.getDisplayValue('severity'),
            age_days: ageInDays,
            due_date: gr.getValue('due_date'),
            assigned_to: gr.getDisplayValue('assigned_to'),
            audit: gr.getDisplayValue('audit')
        };
        if (results[severity]) results[severity].push(findingInfo);
    }
    
    return {
        critical: results.critical,
        high: results.high,
        medium: results.medium,
        low: results.low,
        totals: {
            critical: results.critical.length,
            high: results.high.length,
            medium: results.medium.length,
            low: results.low.length,
            total: results.critical.length + results.high.length + results.medium.length + results.low.length
        }
    };
}

// Audit resource utilization
function getAuditResourceUtilization(startDate, endDate) {
    var utilization = {};
    var gr = new GlideRecord('sn_audit_audit_task');
    gr.addQuery('planned_start_date', '>=', startDate);
    gr.addQuery('planned_end_date', '<=', endDate);
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        var auditor = gr.getDisplayValue('assigned_to');
        if (!auditor) continue;
        if (!utilization[auditor]) utilization[auditor] = { tasks: 0, planned_hours: 0, actual_hours: 0 };
        utilization[auditor].tasks++;
        utilization[auditor].planned_hours += parseFloat(gr.getValue('planned_hours') || '0');
        utilization[auditor].actual_hours += parseFloat(gr.getValue('actual_hours') || '0');
    }
    return Object.keys(utilization).map(function(name) {
        var data = utilization[name];
        return {
            auditor: name,
            tasks: data.tasks,
            planned_hours: data.planned_hours,
            actual_hours: data.actual_hours,
            utilization_rate: data.planned_hours > 0 ? Math.round((data.actual_hours / data.planned_hours) * 100) : 0
        };
    });
}
```

---

## 5. Vendor Risk Management Dashboards

### 5.1 VRM Executive Dashboard

```
Dashboard: Vendor Risk Management Overview
Widgets:
1. Vendor Risk Distribution - Donut (Critical/High/Medium/Low)
2. Vendors by Tier - Stacked Bar (Tier 1/2/3)
3. Assessment Completion Rate - Gauge
4. Overdue Assessments - KPI Card (Red if > 0)
5. Expiring Contracts - Timeline Widget (90 days)
6. Top Risk Vendors - Table (Top 10 by risk score)
7. Assessment Trend - Line Chart (12 months)
8. Fourth-Party Risk Count - KPI Card
```

**GlideRecord Queries for VRM Dashboard:**
```javascript
// VRM executive summary KPIs
function getVRMExecutiveSummary() {
    var summary = {
        total_vendors: 0,
        risk_distribution: { critical: 0, high: 0, medium: 0, low: 0, unrated: 0 },
        assessment_completion: 0,
        overdue_assessments: 0,
        expiring_contracts_30: 0,
        expiring_contracts_90: 0,
        avg_risk_score: 0
    };
    
    var now = new GlideDateTime();
    var d30 = new GlideDateTime(); d30.addDaysLocalTime(30);
    var d90 = new GlideDateTime(); d90.addDaysLocalTime(90);
    
    // Total vendors and risk distribution
    var vendorGr = new GlideRecord('sn_vdr_vendor');
    vendorGr.addQuery('active', true);
    vendorGr.query();
    while (vendorGr.next()) {
        summary.total_vendors++;
        var rating = vendorGr.getValue('current_risk_rating') || 'unrated';
        if (summary.risk_distribution[rating] !== undefined) summary.risk_distribution[rating]++;
        
        // Expiring contracts
        var expiry = vendorGr.getValue('contract_expiry');
        if (expiry) {
            var expiryDate = new GlideDateTime(expiry);
            if (expiryDate.compareTo(now) > 0) {
                if (expiryDate.compareTo(d30) <= 0) summary.expiring_contracts_30++;
                if (expiryDate.compareTo(d90) <= 0) summary.expiring_contracts_90++;
            }
        }
    }
    
    // Overdue assessments
    var overdueGr = new GlideRecord('sn_vdr_vendor_assessment');
    overdueGr.addQuery('state', 'IN', 'draft,in_progress');
    overdueGr.addQuery('due_date', '<', now.getValue());
    overdueGr.addQuery('active', true);
    overdueGr.query();
    summary.overdue_assessments = overdueGr.getRowCount();
    
    return summary;
}
```

---

## 6. Business Continuity Dashboards

### 6.1 BCM Dashboard

```
Dashboard: Business Continuity Management
Widgets:
1. BCP Coverage Rate - Gauge (% of critical processes with BCP)
2. RTO/RPO Compliance - Bar Chart by process
3. BCP Test Results - Donut (Pass/Fail/Not Tested)
4. Outstanding BIA Reviews - KPI
5. DR Test Schedule - Calendar/Timeline
6. Critical Process Dependencies - Sankey/Flow Chart
7. Incident Response Status - Traffic Light Grid
```

**GlideRecord Queries for BCM Dashboard:**
```javascript
// BCP coverage by criticality
function getBCPCoverageReport() {
    var report = { covered: 0, not_covered: 0, outdated: 0, by_criticality: {} };
    var oneYearAgo = new GlideDateTime();
    oneYearAgo.addMonthsLocalTime(-12);
    
    var gr = new GlideRecord('sn_bcm_business_process');
    gr.addQuery('active', true);
    gr.query();
    while (gr.next()) {
        var criticality = gr.getDisplayValue('criticality') || 'medium';
        if (!report.by_criticality[criticality]) {
            report.by_criticality[criticality] = { covered: 0, not_covered: 0 };
        }
        
        var bcpGr = new GlideRecord('sn_bcm_bc_plan');
        bcpGr.addQuery('business_process', gr.getUniqueValue());
        bcpGr.addQuery('state', 'approved');
        bcpGr.addQuery('active', true);
        bcpGr.setLimit(1);
        bcpGr.query();
        
        if (bcpGr.next()) {
            report.covered++;
            report.by_criticality[criticality].covered++;
            var lastReview = bcpGr.getGlideObject('last_review_date');
            if (lastReview && lastReview.compareTo(oneYearAgo) < 0) report.outdated++;
        } else {
            report.not_covered++;
            report.by_criticality[criticality].not_covered++;
        }
    }
    
    var total = report.covered + report.not_covered;
    report.coverage_rate = total > 0 ? Math.round((report.covered / total) * 100) : 0;
    return report;
}
```

---

## 7. KRI/KPI Report Configurations

### Standard IRM KPIs

| KPI Name | Table | Calculation | Target | Alert Threshold |
|----------|-------|-------------|--------|-----------------|
| Risk Closure Rate | sn_risk_risk | Closed/Total * 100 | ≥ 80% | < 60% |
| Control Effectiveness | sn_compliance_control | Effective/Total * 100 | ≥ 85% | < 70% |
| Audit Finding Resolution | sn_audit_finding | Closed/Total * 100 | ≥ 75% | < 50% |
| Vendor Assessment Coverage | sn_vdr_vendor | Assessed/Total * 100 | ≥ 90% | < 75% |
| Policy Attestation Rate | sn_compliance_attestation | Attested/Required * 100 | ≥ 95% | < 85% |
| BCP Test Pass Rate | sn_bcm_test | Passed/Total * 100 | ≥ 90% | < 80% |
| Exception Age (avg days) | sn_compliance_exception | AVG(age) | ≤ 90 days | > 180 days |
| KRI Breach Count | sn_risk_kri_metric | COUNT where status=red | 0 | > 3 |

### KRI Report Query
```javascript
// Monthly IRM KPI Report
function generateMonthlyKPIReport() {
    var report = {
        report_date: new GlideDateTime().getDisplayValue(),
        reporting_period: 'Monthly',
        kpis: []
    };
    
    // Risk Closure Rate
    var totalRisks = new GlideAggregate('sn_risk_risk');
    totalRisks.addQuery('active', true);
    totalRisks.addAggregate('COUNT');
    totalRisks.query();
    var total = totalRisks.next() ? parseInt(totalRisks.getAggregate('COUNT')) : 0;
    
    var closedRisks = new GlideAggregate('sn_risk_risk');
    closedRisks.addQuery('state', 'closed');
    closedRisks.addQuery('active', true);
    closedRisks.addAggregate('COUNT');
    closedRisks.query();
    var closed = closedRisks.next() ? parseInt(closedRisks.getAggregate('COUNT')) : 0;
    
    report.kpis.push({
        name: 'Risk Closure Rate',
        value: total > 0 ? Math.round((closed / total) * 100) : 0,
        unit: '%',
        target: 80,
        status: (total > 0 && Math.round((closed / total) * 100) >= 80) ? 'green' : 'red'
    });
    
    return report;
}
```

---

## 8. GlideRecord Queries for Reports

### Comprehensive Risk Summary Query
```javascript
// Full risk register export
function exportRiskRegister(filters) {
    var risks = [];
    var gr = new GlideRecord('sn_risk_risk');
    gr.addQuery('active', true);
    if (filters && filters.category) gr.addQuery('category', filters.category);
    if (filters && filters.owner) gr.addQuery('owned_by', filters.owner);
    if (filters && filters.rating) gr.addQuery('risk_rating', filters.rating);
    gr.orderByDesc('risk_score');
    gr.query();
    
    while (gr.next()) {
        risks.push({
            risk_id: gr.getValue('number'),
            name: gr.getValue('name'),
            description: gr.getValue('description'),
            category: gr.getDisplayValue('category'),
            subcategory: gr.getDisplayValue('subcategory'),
            likelihood: gr.getDisplayValue('likelihood'),
            impact: gr.getDisplayValue('impact'),
            inherent_score: gr.getValue('inherent_risk_score'),
            control_effectiveness: gr.getValue('control_effectiveness'),
            residual_score: gr.getValue('risk_score'),
            risk_rating: gr.getDisplayValue('risk_rating'),
            treatment_type: gr.getDisplayValue('treatment_type'),
            treatment_plan: gr.getValue('treatment_plan'),
            owner: gr.getDisplayValue('owned_by'),
            reviewer: gr.getDisplayValue('reviewer'),
            review_date: gr.getValue('review_date'),
            state: gr.getDisplayValue('state'),
            created: gr.getValue('sys_created_on'),
            last_updated: gr.getValue('sys_updated_on')
        });
    }
    return risks;
}
```

### Cross-Module Integrated Report
```javascript
// IRM Integrated Risk & Compliance Report
function generateIntegratedIRMReport(entitySysId) {
    var report = { entity_id: entitySysId, sections: {} };
    
    // Risk section
    var riskGr = new GlideRecord('sn_risk_risk');
    riskGr.addQuery('entity', entitySysId);
    riskGr.addQuery('active', true);
    riskGr.query();
    report.sections.risks = { total: 0, high_critical: 0, open_treatment_items: 0 };
    while (riskGr.next()) {
        report.sections.risks.total++;
        var rating = riskGr.getValue('risk_rating');
        if (rating === 'high' || rating === 'critical') report.sections.risks.high_critical++;
    }
    
    // Compliance section
    var ctrlGr = new GlideRecord('sn_compliance_control');
    ctrlGr.addQuery('applicable_entity', entitySysId);
    ctrlGr.addQuery('active', true);
    ctrlGr.query();
    report.sections.controls = { total: 0, compliant: 0, non_compliant: 0, exceptions: 0 };
    while (ctrlGr.next()) {
        report.sections.controls.total++;
        var state = ctrlGr.getValue('state');
        if (state === 'compliant' || state === 'effective') report.sections.controls.compliant++;
        else report.sections.controls.non_compliant++;
    }
    
    return report;
}
```

---

## 9. Scheduled Reports Setup

### Configuration for Automated Reports

| Report Name | Frequency | Recipients | Format | Time |
|-------------|-----------|------------|--------|------|
| Weekly Risk Summary | Weekly (Mon) | Risk Manager, CISO | PDF, Excel | 07:00 |
| Monthly Compliance Scorecard | Monthly (1st) | Compliance Team, Board | PDF | 08:00 |
| Quarterly KRI Dashboard | Quarterly | Executive Team | PDF | 09:00 |
| Daily Overdue Items | Daily | Module Owners | Email | 08:00 |
| Annual Risk Report | Annually (Jan 1) | Board, Audit Committee | PDF | 06:00 |

### Scheduled Report Script (Business Rule / Script Include)
```javascript
// Automated weekly risk report generation
var WeeklyRiskReport = Class.create();
WeeklyRiskReport.prototype = {
    initialize: function() {
        this.reportDate = new GlideDateTime();
    },
    
    generate: function() {
        var report = {
            period: 'Weekly',
            from: gs.getProperty('sn_irm.report.from_email'),
            generated: this.reportDate.getDisplayValue(),
            sections: {
                new_risks: this.getNewRisks(7),
                closed_risks: this.getClosedRisks(7),
                overdue_reviews: this.getOverdueReviews(),
                kri_breaches: this.getKRIBreaches()
            }
        };
        return report;
    },
    
    getNewRisks: function(days) {
        var cutoff = new GlideDateTime();
        cutoff.addDaysLocalTime(-days);
        var gr = new GlideRecord('sn_risk_risk');
        gr.addQuery('sys_created_on', '>=', cutoff.getValue());
        gr.query();
        return gr.getRowCount();
    },
    
    getClosedRisks: function(days) {
        var cutoff = new GlideDateTime();
        cutoff.addDaysLocalTime(-days);
        var gr = new GlideRecord('sn_risk_risk');
        gr.addQuery('sys_updated_on', '>=', cutoff.getValue());
        gr.addQuery('state', 'closed');
        gr.query();
        return gr.getRowCount();
    },
    
    getOverdueReviews: function() {
        var now = new GlideDateTime();
        var gr = new GlideRecord('sn_risk_risk');
        gr.addQuery('state', 'open');
        gr.addQuery('review_date', '<', now.getValue());
        gr.addQuery('active', true);
        gr.query();
        return gr.getRowCount();
    },
    
    getKRIBreaches: function() {
        var gr = new GlideRecord('sn_risk_kri_metric');
        gr.addQuery('status', 'red');
        gr.addQuery('active', true);
        gr.query();
        return gr.getRowCount();
    },
    
    type: 'WeeklyRiskReport'
};
```

---

## 10. Dashboard Widget Reference

### Available Widget Types in ServiceNow IRM

| Widget Type | Best For | Table Examples |
|-------------|----------|----------------|
| Gauge/Dial | Single KPI value | Compliance score, Risk score |
| Donut/Pie | Distribution by category | Risk by rating, Control states |
| Bar Chart | Comparison across groups | Risks by category, Findings by audit |
| Line Chart | Trends over time | Risk score trend, Compliance trend |
| Heat Map | Matrix visualization | Risk heat map (likelihood x impact) |
| List Widget | Actionable items | Overdue items, Top risks |
| Scorecard | Multi-metric summary | Executive KPI overview |
| Funnel | Process stages | Audit lifecycle, Control testing pipeline |
| Map Widget | Geographic risk | Vendor geographic risk |
| Forecast | Predictive | Risk trend prediction |

### Widget Data Configuration Tips

```
Performance Best Practices:
1. Use GlideAggregate instead of GlideRecord for count/sum operations
2. Add sys_indexes on frequently filtered fields
3. Use report caching for dashboards refreshed > every 15 mins
4. Limit list widgets to max 20 rows with pagination
5. Use asynchronous refresh for widgets with complex queries

Conditional Formatting Rules:
- Risk Rating: critical=red (#d9534f), high=orange (#f0ad4e), medium=yellow (#f5e642), low=green (#5cb85c)
- Compliance: non_compliant=red, in_review=yellow, compliant=green, not_tested=grey
- Findings: critical=purple (#9b59b6), high=red, medium=orange, low=blue

Common Filter Conditions for Widgets:
- Active records: active=true
- Current year: sys_created_on>=javascript:gs.beginningOfYear()
- Current quarter: sys_created_on>=javascript:gs.beginningOfQuarter()
- My items: assigned_toINJAVASCRIPT:gs.getUserID()
```

---

*ServiceNow IRM Toolkit - Reports & Dashboard Configuration Guide*  
*Last Updated: April 2026 | Author: Ankit Uniyal | Version: 2.0*
