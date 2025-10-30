import { SpecializedAgent, SpecializedAgentConfig } from './specialized-agent';

/**
 * Security review agent - analyzes code for vulnerabilities and security issues
 */
export class SecurityAgent extends SpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super(config);
  }

  /**
   * Required sections for security review plans
   */
  protected getRequiredSections(): string[] {
    return [
      '# ',  // Title
      '## Threat Analysis',
      '## OWASP Top 10 Assessment',
      '## Security Requirements',
      '## Vulnerability Assessment',
      '## Mitigation Strategies',
      '## Compliance Requirements',
      '## Security Testing',
      '## Incident Response Plan',
    ];
  }

  /**
   * Get agent type identifier
   */
  protected getAgentType(): string {
    return 'security';
  }

  /**
   * Override to add security-specific task prompt
   */
  protected buildTaskPrompt(task: string, dependencies: string[]): string {
    let prompt = `SECURITY REVIEW TASK: ${task}\n\n`;

    if (dependencies.length > 0) {
      prompt += `## Implementation Plans to Review\n\n`;
      prompt += `The following files contain implementation plans that need security review:\n`;
      dependencies.forEach(dep => {
        prompt += `- ${dep}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please create a comprehensive security review following the template structure.\n`;
    prompt += `Focus on:\n`;
    prompt += `1. OWASP Top 10 vulnerabilities\n`;
    prompt += `2. Authentication and authorization issues\n`;
    prompt += `3. Data encryption and protection\n`;
    prompt += `4. Input validation and sanitization\n`;
    prompt += `5. SQL injection, XSS, CSRF risks\n`;
    prompt += `6. API security concerns\n`;
    prompt += `7. Secrets management\n`;
    prompt += `8. Compliance requirements (GDPR, PCI-DSS, etc.)\n`;
    prompt += `9. Security testing requirements\n`;
    prompt += `10. Incident response procedures\n`;

    return prompt;
  }
}
