import { SpecializedAgent, SpecializedAgentConfig } from './specialized-agent';

/**
 * Implementation planning agent - creates detailed technical implementation plans
 */
export class ImplementationAgent extends SpecializedAgent {
  constructor(config: SpecializedAgentConfig) {
    super(config);
  }

  /**
   * Required sections for implementation plans
   */
  protected getRequiredSections(): string[] {
    return [
      '# ',  // Title
      '## Context Summary',
      '## Implementation Steps',
      '## Error Handling Strategy',
      '## Type Safety',
      '## Testing Requirements',
      '## Success Metrics',
      '## Incremental Implementation Checkpoints',
      '## Rollback Strategy',
    ];
  }

  /**
   * Get agent type identifier
   */
  protected getAgentType(): string {
    return 'implementation';
  }
}
