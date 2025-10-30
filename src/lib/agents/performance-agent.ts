import { SpecializedAgent, SpecializedAgentConfig } from './specialized-agent';

/**
 * Performance analysis agent - evaluates and optimizes system performance
 */
export class PerformanceAgent extends SpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super(config);
  }

  /**
   * Required sections for performance analysis plans
   */
  protected getRequiredSections(): string[] {
    return [
      '# ',  // Title
      '## Performance Baseline',
      '## Bottleneck Analysis',
      '## Optimization Strategy',
      '## Resource Utilization',
      '## Scalability Assessment',
      '## Caching Strategy',
      '## Database Optimization',
      '## Performance Testing',
      '## Monitoring & Alerting',
    ];
  }

  /**
   * Get agent type identifier
   */
  protected getAgentType(): string {
    return 'performance';
  }

  /**
   * Override to add performance-specific task prompt
   */
  protected buildTaskPrompt(task: string, dependencies: string[]): string {
    let prompt = `PERFORMANCE ANALYSIS TASK: ${task}\n\n`;

    if (dependencies.length > 0) {
      prompt += `## Implementation Plans to Analyze\n\n`;
      prompt += `The following files contain implementation plans that need performance analysis:\n`;
      dependencies.forEach(dep => {
        prompt += `- ${dep}\n`;
      });
      prompt += '\n';
    }

    prompt += `Please create a comprehensive performance analysis following the template structure.\n`;
    prompt += `Focus on:\n`;
    prompt += `1. Performance baselines and targets\n`;
    prompt += `2. Latency and throughput requirements\n`;
    prompt += `3. Memory and CPU utilization\n`;
    prompt += `4. Database query optimization\n`;
    prompt += `5. N+1 query problems\n`;
    prompt += `6. Caching strategies (Redis, CDN, etc.)\n`;
    prompt += `7. Load balancing and horizontal scaling\n`;
    prompt += `8. Connection pooling\n`;
    prompt += `9. Async processing and queue systems\n`;
    prompt += `10. Performance monitoring tools\n`;
    prompt += `11. Load testing scenarios\n`;
    prompt += `12. Performance budgets\n`;

    return prompt;
  }
}
