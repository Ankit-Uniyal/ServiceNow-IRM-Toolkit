# ✅ ServiceNow IRM Best Practices & Pro Tips

## Overview
Compiled from 20+ years of ServiceNow IRM implementations across Fortune 500 companies,
financial institutions, healthcare organizations, and government agencies.

---

## 🏗️ IMPLEMENTATION BEST PRACTICES

### 1. Start with a Risk Taxonomy
Before touching any configuration, define your risk taxonomy:
- Agree on risk categories (Cybersecurity, Operational, Financial, Compliance, Strategic)
- Define your likelihood and impact scales (3x3, 4x4, 5x5)
- Establish risk appetite statements per category
- Get executive sign-off before configuring in ServiceNow

**Pro Tip**: Use the sn_risk_definition table to pre-populate standard risk statements.
This prevents duplicate risks and ensures consistent language.

### 2. UCF First, Custom Controls Second
Always start with ServiceNow's UCF content library:
- Import authority documents from UCF (ISO 27001, NIST CSF, etc.)
- Map your existing controls to UCF control objectives
- Only create custom controls when UCF doesn't cover your need
- This enables cross-framework compliance mapping automatically

**Pro Tip**: One control mapped to multiple frameworks = massive efficiency gain.
A properly configured UCF can reduce compliance workload by 40-60%.

### 3. Data Quality Rules
Enforce data quality from day one:
- Make risk owner and category mandatory fields
- Set up mandatory review dates for all policies
- Require root cause for all audit findings
- Enforce evidence fields on control test results

**Pro Tip**: Use Client Scripts to validate data before saving, not Business Rules.
Catches issues at input rather than database level.

### 4. Role Design
Standard IRM Role Hierarchy:

| Role | Key Permissions | ServiceNow Role |
|------|----------------|----------------|
| IRM Admin | Full config access | sn_risk.admin, sn_compliance.admin |
| Risk Manager | Create/edit all risks | sn_risk.manager |
| Risk Owner | Edit own risks | sn_risk.owner |
| Compliance Manager | Full policy/control access | sn_compliance.manager |
| Control Owner | Edit assigned controls | sn_compliance.control_owner |
| Auditor | Read risk/compliance, full audit | sn_audit.auditor |
| Lead Auditor | All audit permissions | sn_audit.lead_auditor |
| Vendor Risk Analyst | VRM module | sn_vdr.analyst |
| Read Only | View dashboards/reports | sn_risk.reader |

---

## 💻 SCRIPTING BEST PRACTICES

### 5. Always Use Encoded Queries
Encoded queries are more efficient and maintainable than multiple addQuery calls:

```javascript
// GOOD: Use encoded query for complex conditions
var gr = new GlideRecord('sn_risk_risk');
gr.addEncodedQuery('state=open^residual_score>=10^category=cybersecurity');
gr.query();

// LESS OPTIMAL: Multiple addQuery calls
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.addQuery('residual_score', '>=', 10);
gr.addQuery('category', 'cybersecurity');
gr.query();
```

### 6. Use GlideAggregate for Counts
Never use GlideRecord to count records:

```javascript
// CORRECT: Use GlideAggregate for counting
var agg = new GlideAggregate('sn_risk_risk');
agg.addQuery('state', 'open');
agg.addAggregate('COUNT');
agg.query();
agg.next();
var count = parseInt(agg.getAggregate('COUNT'));

// WRONG: Never do this
var count = 0;
var gr = new GlideRecord('sn_risk_risk');
gr.addQuery('state', 'open');
gr.query();
while (gr.next()) count++;  // Expensive!
```

### 7. Limit Record Queries
Always set limits on queries that could return large datasets:

```javascript
// Set limit to prevent performance issues
var gr = new GlideRecord('sn_audit_finding');
gr.addQuery('state', '!=', 'closed');
gr.setLimit(100);  // Always set a reasonable limit
gr.orderByDesc('sys_created_on');
gr.query();
```

### 8. Business Rule Performance
- Use async Business Rules where real-time updates aren't needed
- Avoid database queries in 'Before' Business Rules
- Use conditions to prevent unnecessary rule execution
- Never create recursive Business Rules

```javascript
// GOOD: Condition prevents unnecessary execution
// Business Rule Condition: current.state == 'open' && current.state.changes()
(function executeRule(current, previous) {
    // Only runs when state changes TO open
    assignRiskOwner(current);
})(current, previous);

// BAD: Runs on every save
(function executeRule(current, previous) {
    if (current.state == 'open') {  // Should be in condition, not script
        assignRiskOwner(current);
    }
})(current, previous);
```

### 9. Script Include Best Practices
Centralize reusable IRM logic in Script Includes:

```javascript
// Script Include: IRMUtilities
var IRMUtilities = Class.create();
IRMUtilities.prototype = {
    initialize: function() {},
    
    // Calculate risk score
    calculateRiskScore: function(likelihood, impact) {
        var score = likelihood * impact;
        return {
            score: score,
            rating: this.getRiskRating(score)
        };
    },
    
    // Get risk rating from score
    getRiskRating: function(score) {
        if (score >= 16) return 'critical';
        if (score >= 10) return 'high';
        if (score >= 5) return 'medium';
        return 'low';
    },
    
    // Get risk appetit for category
    getRiskAppetite: function(category) {
        var appetite = new GlideRecord('sn_risk_risk_appetite');
        appetite.addQuery('category', category);
        appetite.setLimit(1);
        appetite.query();
        if (appetite.next()) {
            return parseInt(appetite.threshold);
        }
        return 9; // Default medium appetite
    },
    
    type: 'IRMUtilities'
};
```

---

## 📊 REPORTING BEST PRACTICES

### 10. KPI/KRI Dashboard Design
- Show trend data (not just current state)
- Use RAG (Red/Amber/Green) consistently
- Include drill-down from KPI to underlying records
- Executive dashboards: max 5-7 KPIs
- Operational dashboards: detailed metrics by owner

### 11. Scheduled Report Distribution
- Weekly: Control test results, overdue findings
- Monthly: Risk register summary, compliance posture
- Quarterly: Audit plan progress, KRI trends
- Annually: Board risk report, audit committee report

### 12. Report Table Recommendations

| Report | Table | Key Filters |
|--------|-------|-------------|
| Risk Heatmap | sn_risk_risk | state=open |
| Compliance Posture | sn_compliance_test_result | tested_on this quarter |
| Finding Aging | sn_audit_finding | state!=closed |
| KRI Dashboard | sn_risk_kri | active=true |
| Vendor Risk | sn_vdr_vendor_assessment | state=approved |
| Policy Coverage | sn_compliance_policy | state=published |

---

## 🔒 SECURITY BEST PRACTICES

### 13. Data Access Controls
- Use ACLs (Access Control Lists) to restrict risk data by category
- Sensitive risks (M&A, executive compensation) should have elevated access
- Audit team should have read-only access to risk and compliance
- Vendors should only see their own VRM assessment portal

### 14. Audit Trail
- Enable field-level auditing on all IRM tables
- Key fields to audit: state, score, owner, category, due_date
- Never delete IRM records - use state changes to 'retired'
- Archive old records rather than deleting

---

## 🚀 PERFORMANCE BEST PRACTICES

### 15. Table Design
- Don't add unnecessary custom fields to core IRM tables
- Use related tables for domain-specific data
- Index frequently-searched fields (owner, category, state)
- Use choice lists instead of free text where possible

### 16. Flow Designer Optimization
- Use subflows for reusable logic
- Avoid loops with database queries inside
- Use async execution for non-blocking operations
- Cache lookup values in flow variables

---

## 📋 GOVERNANCE BEST PRACTICES

### 17. IRM Governance Committee
Establish an IRM Steering Committee with:
- CISO/CRO as executive sponsor
- Risk, Compliance, Audit, IT, Legal representatives
- Monthly meetings to review platform health
- Quarterly taxonomy review

### 18. Change Management for IRM Platform
- All configuration changes through ServiceNow Update Sets
- Test in dev/test before production
- Maintain an IRM Change Log
- User acceptance testing for all workflow changes

### 19. Training & Adoption
- Role-based training materials
- Quick reference cards for each module
- Monthly office hours for IRM platform questions
- Gamification for attestation completion rates

### 20. Integration Architecture
- Use Integration Hub for all external connections
- Avoid direct database connections from ServiceNow
- Implement API rate limiting and error handling
- Log all integration failures to a monitoring table

---

## 🎯 COMMON MISTAKES TO AVOID

| Mistake | Why it's a Problem | Better Approach |
|---------|-------------------|-----------------|
| Over-customizing | Hard to upgrade | Use OOB wherever possible |
| Too many risk categories | Analysis paralysis | Start with 5-7 categories |
| No risk appetite defined | Risks without context | Define before go-live |
| Manual KRI updates | Quickly becomes stale | Automate from source systems |
| All risks rated 'high' | Loss of differentiation | Train risk owners on scoring |
| Audit findings never close | Compliance fatigue | Strict 90-day SLAs |
| No workflow notifications | Low adoption | Automate all key events |
| Vendor assessment PDFs | Not trackable | Use portal questionnaires |

---

*Part of ServiceNow IRM Toolkit | [Back to Main README](../../README.md)*
