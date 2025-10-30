# Creating Specialized Agents from the Implementation Template

## How to Adapt the Template

The core template structure works for ALL specialized agents. You just need to:

1. **Replace `{DOMAIN}`** with the agent's specialty (e.g., "Python Backend Development", "React Frontend Architecture", "Database Design", "DevOps Infrastructure")
2. **Modify the plan structure** to focus on that domain's outputs
3. **Adjust the tools/MCPs** list for domain-specific needs
4. **Change the output format** to match what other agents expect

---

## 1. Security Review Agent

**Domain:** `"Application Security & Compliance"`

### Key Modifications:

**Plan Structure Changes:**
```markdown
# Security Review Plan
**Domain:** Application Security & Compliance
**Review Type:** {PCI/HIPAA/SOX/General}
**Threat Model:** {Web App/API/Mobile/Desktop}

## 1. Context from claude.md
- Application architecture
- Data sensitivity levels
- Compliance requirements
- Existing security measures

## 2. Threat Analysis
### Attack Surface
- {Entry point 1}: {Risk level} - {Mitigation}
- {Entry point 2}: {Risk level} - {Mitigation}

### OWASP Top 10 Assessment
- A01 Broken Access Control: {Status/Recommendations}
- A02 Cryptographic Failures: {Status/Recommendations}
[... continue for all 10]

## 3. Security Requirements
### Authentication/Authorization
- {Requirement 1}