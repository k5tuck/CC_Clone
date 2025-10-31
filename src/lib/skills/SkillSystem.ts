// File: src/lib/skills/SkillSystem.ts
// Complete, production-ready Skills implementation

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  content: string;
  path: string;
  templates?: Map<string, string>;
  scripts?: Map<string, string>;
  resources?: Map<string, Buffer>;
}

export interface SkillMatch {
  skill: Skill;
  confidence: number;
  reason: string;
}

// Custom Exceptions
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

export class SkillNotFoundError extends SkillError {
  constructor(skillName: string) {
    super(`Skill not found: ${skillName}`, skillName);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillValidationError extends SkillError {
  constructor(skillName: string, reason: string, cause?: Error) {
    super(`Skill validation failed: ${reason}`, skillName, cause);
    this.name = 'SkillValidationError';
  }
}