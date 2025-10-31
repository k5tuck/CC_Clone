
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  activation_keywords?: string[];
  dependencies?: string[];
  requires_code_execution?: boolean;
}

export interface Skill {
  metadata: SkillMetadata;
  content: string;           // The full SKILL.md content
  path: string;              // Path to skill directory
  templates?: Map<string, string>;
  scripts?: Map<string, string>;
  resources?: Map<string, Buffer>;
}

export interface SkillMatch {
  skill: Skill;
  confidence: number;        // 0-1 score
  reason: string;            // Why this skill was matched
}

export class SkillError extends Error {
  constructor(
    message: string,
    public readonly skillName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SkillError';
  }
}