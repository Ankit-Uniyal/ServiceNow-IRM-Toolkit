# 🛡️ ServiceNow IRM Toolkit
> **The Most Comprehensive ServiceNow Integrated Risk Management (IRM) Reference Guide**
> Built by a GRC & IRM Expert | 20+ Years ServiceNow Experience

[![ServiceNow](https://img.shields.io/badge/ServiceNow-IRM-green)](https://www.servicenow.com)
[![GRC](https://img.shields.io/badge/GRC-Toolkit-blue)](https://github.com/Ankit-Uniyal/ServiceNow-IRM-Toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📚 Table of Contents

| # | Module | Description |
|---|--------|-------------|
| 1 | [IRM Overview](#-servicenow-irm-overview) | Architecture, Modules, Licensing |
| 2 | [Policy & Compliance (UCF)](#-policy--compliance-management) | Policies, Controls, UCF Framework |
| 3 | [Risk Management](#-risk-management-module) | Risk Register, Assessments, SoR |
| 4 | [Audit Management](#-audit-management-module) | Audit Plans, Engagements, Findings |
| 5 | [Vendor Risk Management](#-vendor-risk-management-vrm) | Third-party Risk, Assessments |
| 6 | [Business Continuity](#-business-continuity-management-bcm) | BIA, BCP, DR Plans |
| 7 | [Operational Resilience](#-operational-resilience) | Incident Response, RCSA |
| 8 | [GlideRecord Scripts](#-gliderecord-scripts--queries) | 50+ Ready-to-use Scripts |
| 9 | [Workflows & Flows](#-workflows--flow-designer-flows) | Flow Builder Templates |
| 10 | [Reports & Dashboards](#-reports--dashboards) | KRI, KPI Queries |
| 11 | [Audit Queries](#-audit--compliance-queries) | Compliance Check Scripts |
| 12 | [Integration Guide](#-integration-patterns) | API, REST, Integrations |
| 13 | [Best Practices](#-best-practices--pro-tips) | Expert Tips |
| 14 | [Troubleshooting](#-troubleshooting-guide) | Common Issues & Fixes |

---

## 🏗️ ServiceNow IRM Overview

### What is ServiceNow IRM?
ServiceNow IRM (Integrated Risk Management) is a unified platform that brings together risk, compliance, audit, and security operations into a single system of record. It aligns with frameworks like ISO 31000, NIST CSF, COSO, ISO 27001, SOC 2, and GDPR.

### IRM Module Architecture
```
ServiceNow IRM Platform
├── Policy & Compliance Management (PCM)
│   ├── Unified Compliance Framework (UCF)
│   ├── Policy Management
│   ├── Control Testing
│   └── Exception Management
├── Risk Management (RM)
│   ├── Risk Register
│   ├── Risk Assessment
│   ├── Statement of Risk (SoR)
│   └── Key Risk Indicators (KRI)
├── Audit Management (AM)
│   ├── Audit Universe
│   ├── Audit Planning
│   ├── Audit Engagement
│   └── Findings & Recommendations
├── Vendor Risk Management (VRM)
│   ├── Vendor Assessment
│   ├── Third-Party Risk
│   └── Contract Risk
├── Business Continuity Management (BCM)
│   ├── Business Impact Analysis (BIA)
│   ├── Business Continuity Plan (BCP)
│   └── Disaster Recovery (DR)
└── Operational Resilience (OR)
    ├── RCSA (Risk Control Self Assessment)
    ├── Incident Management
    └── Issue Management
```

### Key IRM Tables Reference
| Table Name | Label | Description |
|------------|-------|-------------|
| sn_risk_risk | Risk | Core risk register table |
| sn_risk_risk_assessment | Risk Assessment | Risk assessment records |
| sn_risk_risk_assessment_task | Risk Assessment Task | Assessment tasks |
| sn_compliance_policy | Policy | Policy management |
| sn_compliance_control | Control | Control library |
| sn_compliance_control_objective | Control Objective | UCF control objectives |
| sn_audit_audit | Audit | Audit engagements |
| sn_audit_finding | Finding | Audit findings |
| sn_audit_audit_universe | Audit Universe | Audit universe entities |
| sn_risk_m2m_risk_control | Risk-Control Mapping | M2M risk to control |
| sn_risk_risk_statement | Risk Statement | Risk statement library |
| sn_vdr_vendor_assessment | Vendor Assessment | VRM assessments |
| sn_bcm_bc_plan | Business Continuity Plan | BCP records |
| sn_rcsa_rcsa | RCSA | Self-assessment records |

---

## 📋 Policy & Compliance Management

### Module Overview
Policy & Compliance Management (PCM) provides a structured approach to creating, publishing, and attesting policies, mapping them to regulatory controls, and tracking compliance posture.

### Key Concepts
- **Policy**: A high-level statement of intent (e.g., Information Security Policy)
- **Standard**: Detailed requirements derived from policies
- **Control Objective**: What must be achieved (from UCF/regulatory frameworks)
- **Control**: How the objective is achieved (technical or procedural)
- **Control Test**: Evidence that a control is working effectively

### PCM Workflow
```
Draft Policy → Review → Approve → Publish → Attest → Monitor → Review/Retire
```

### Important PCM Tables
| Table | Description |
|-------|-------------|
| sn_compliance_policy | Policy records |
| sn_compliance_policy_statement | Policy statements |
| sn_compliance_control | Controls |
| sn_compliance_control_objective | Control objectives (UCF) |
| sn_compliance_attestation | Policy attestations |
| sn_compliance_exception | Control exceptions |
| sn_compliance_test_plan | Control test plans |
| sn_compliance_test_result | Test results |
| sn_compliance_aw_indicator | Compliance indicators |

See [PCM Module Guide](docs/01-policy-compliance/PCM-Guide.md) for full details.

---

## ⚠️ Risk Management Module

### Module Overview
Risk Management provides a systematic approach to identifying, assessing, treating, and monitoring risks across the enterprise using a structured risk register and assessment methodology.

### Risk Lifecycle
```
Identify Risk → Categorize → Assess (Likelihood x Impact) → 
Treat (Accept/Mitigate/Transfer/Avoid) → Monitor → Review
```

### Risk Scoring Matrix
```
Impact →    1-Low    2-Med    3-High   4-Critical
Likelihood↓
1-Rare      1        2        3        4
2-Unlikely  2        4        6        8
3-Possible  3        6        9        12
4-Likely    4        8        12       16
5-Almost    5        10       15       20
```

See [Risk Management Guide](docs/02-risk-management/Risk-Management-Guide.md) for full details.

---

## 🔍 Audit Management Module

### Module Overview
Audit Management supports the complete internal audit lifecycle from universe maintenance and annual planning through fieldwork, findings, and recommendation tracking.

### Audit Lifecycle
```
Audit Universe → Audit Plan → Audit Engagement → 
Planning → Fieldwork → Reporting → Finding Mgmt → Closure
```

See [Audit Management Guide](docs/03-audit-management/Audit-Management-Guide.md) for full details.

---

## 🏢 Vendor Risk Management (VRM)

### Module Overview
VRM enables systematic management of third-party and vendor risks through structured onboarding, risk assessment, continuous monitoring, and contract risk management.

See [VRM Guide](docs/04-vendor-risk/VRM-Guide.md) for full details.

---

## 🔄 Business Continuity Management (BCM)

### Module Overview
BCM supports planning, testing, and maintaining business continuity and disaster recovery capabilities, including Business Impact Analysis (BIA) and BCP documentation.

See [BCM Guide](docs/05-business-continuity/BCM-Guide.md) for full details.

---

## 🔐 Operational Resilience

### Module Overview
Operational Resilience in ServiceNow IRM includes RCSA, issue management, and operational risk tracking to ensure ongoing business resilience.

See [Operational Resilience Guide](docs/06-operational-resilience/OR-Guide.md) for full details.

---

## 💻 GlideRecord Scripts & Queries

See [Scripts Directory](scripts/) for 50+ ready-to-use GlideRecord scripts covering:
- Risk queries and reporting
- Compliance control testing
- Audit finding management
- Vendor risk assessments
- Bulk operations and automation

---

## 🔀 Workflows & Flow Designer Flows

See [Workflows Directory](workflows/) for Flow Designer templates covering:
- Risk assessment workflows
- Policy approval workflows
- Audit engagement workflows
- Vendor assessment workflows
- Exception management workflows

---

## 📊 Reports & Dashboards

See [Reports Directory](reports/) for KRI/KPI queries and dashboard configurations.

---

## 🔎 Audit & Compliance Queries

See [Audit Queries Directory](audit-queries/) for compliance audit scripts.

---

## 🔗 Integration Patterns

See [Integration Guide](docs/integrations/Integration-Guide.md) for API patterns, REST integrations, and third-party connections.

---

## ✅ Best Practices & Pro Tips

See [Best Practices Guide](docs/best-practices/Best-Practices.md) for expert recommendations.

---

## 🛠️ Troubleshooting Guide

See [Troubleshooting Guide](docs/troubleshooting/Troubleshooting.md) for common issues and solutions.

---

## 📁 Repository Structure

```
ServiceNow-IRM-Toolkit/
├── README.md                          # This file
├── docs/
│   ├── 01-policy-compliance/
│   │   └── PCM-Guide.md
│   ├── 02-risk-management/
│   │   └── Risk-Management-Guide.md
│   ├── 03-audit-management/
│   │   └── Audit-Management-Guide.md
│   ├── 04-vendor-risk/
│   │   └── VRM-Guide.md
│   ├── 05-business-continuity/
│   │   └── BCM-Guide.md
│   ├── 06-operational-resilience/
│   │   └── OR-Guide.md
│   ├── integrations/
│   │   └── Integration-Guide.md
│   ├── best-practices/
│   │   └── Best-Practices.md
│   └── troubleshooting/
│       └── Troubleshooting.md
├── scripts/
│   ├── risk-management/
│   ├── policy-compliance/
│   ├── audit-management/
│   ├── vendor-risk/
│   └── utilities/
├── workflows/
│   ├── risk-workflows/
│   ├── audit-workflows/
│   └── compliance-workflows/
├── reports/
│   └── dashboard-configs/
└── audit-queries/
    └── compliance-checks/
```

---

## 🤝 Contributing

Contributions welcome! Please submit PRs with improvements, additional scripts, or documentation updates.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

*Built with 20+ years of ServiceNow IRM expertise | Maintained by Ankit Uniyal*
