/**
 * Pattern Recognition System
 * Detects recurring patterns in code, conversations, and user behavior
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Pattern types
 */
export enum PatternType {
  CODE_STRUCTURE = 'code_structure',
  USER_WORKFLOW = 'user_workflow',
  ERROR_SEQUENCE = 'error_sequence',
  CONVERSATION_FLOW = 'conversation_flow',
  FILE_ACCESS = 'file_access',
  TOOL_USAGE = 'tool_usage',
  NAMING_CONVENTION = 'naming_convention',
}

/**
 * Pattern confidence level
 */
export enum ConfidenceLevel {
  LOW = 'low',           // < 50%
  MEDIUM = 'medium',     // 50-75%
  HIGH = 'high',         // 75-90%
  VERY_HIGH = 'very_high', // > 90%
}

/**
 * Detected pattern
 */
export interface DetectedPattern {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  occurrences: number;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-1
  firstSeen: Date;
  lastSeen: Date;
  examples: PatternExample[];
  metadata: Record<string, any>;
  tags: string[];
}

/**
 * Pattern example
 */
export interface PatternExample {
  timestamp: Date;
  context: string;
  excerpt: string;
  relevance: number; // 0-1
}

/**
 * Pattern match
 */
export interface PatternMatch {
  pattern: DetectedPattern;
  matchScore: number; // 0-1
  matchedAt: Date;
  context: string;
}

/**
 * Pattern observation
 */
interface PatternObservation {
  timestamp: Date;
  type: PatternType;
  data: any;
  context: string;
}

/**
 * Pattern Recognition System
 */
export class PatternRecognition extends EventEmitter {
  private patterns: Map<string, DetectedPattern> = new Map();
  private observations: PatternObservation[] = [];
  private patternsFile: string;
  private maxObservations = 1000;
  private minOccurrences = 3; // Minimum occurrences to consider it a pattern

  constructor(customPatternsFile?: string) {
    super();
    this.patternsFile = customPatternsFile || path.join(os.homedir(), '.selek', 'patterns.json');
  }

  /**
   * Initialize the pattern recognition system
   */
  async initialize(): Promise<void> {
    await this.loadPatterns();
    this.emit('initialized');
  }

  /**
   * Observe a code structure pattern
   */
  observeCodeStructure(code: string, context: string): void {
    this.addObservation(PatternType.CODE_STRUCTURE, {
      structure: this.extractCodeStructure(code),
      language: this.detectLanguage(code),
    }, context);
    this.analyzePatterns(PatternType.CODE_STRUCTURE);
  }

  /**
   * Observe a user workflow pattern
   */
  observeWorkflow(action: string, context: string): void {
    this.addObservation(PatternType.USER_WORKFLOW, {
      action,
      timestamp: Date.now(),
    }, context);
    this.analyzePatterns(PatternType.USER_WORKFLOW);
  }

  /**
   * Observe an error sequence pattern
   */
  observeError(error: string, stack: string, context: string): void {
    this.addObservation(PatternType.ERROR_SEQUENCE, {
      error,
      stack,
      errorType: this.classifyError(error),
    }, context);
    this.analyzePatterns(PatternType.ERROR_SEQUENCE);
  }

  /**
   * Observe a conversation flow pattern
   */
  observeConversation(userMessage: string, agentResponse: string, context: string): void {
    this.addObservation(PatternType.CONVERSATION_FLOW, {
      userMessage,
      agentResponse,
      intent: this.detectIntent(userMessage),
    }, context);
    this.analyzePatterns(PatternType.CONVERSATION_FLOW);
  }

  /**
   * Observe a file access pattern
   */
  observeFileAccess(filePath: string, operation: 'read' | 'write' | 'delete', context: string): void {
    this.addObservation(PatternType.FILE_ACCESS, {
      filePath,
      operation,
      fileType: path.extname(filePath),
      directory: path.dirname(filePath),
    }, context);
    this.analyzePatterns(PatternType.FILE_ACCESS);
  }

  /**
   * Observe a tool usage pattern
   */
  observeToolUsage(toolName: string, args: any, result: any, context: string): void {
    this.addObservation(PatternType.TOOL_USAGE, {
      toolName,
      args,
      result,
      success: !result?.error,
    }, context);
    this.analyzePatterns(PatternType.TOOL_USAGE);
  }

  /**
   * Get all detected patterns
   */
  getPatterns(type?: PatternType): DetectedPattern[] {
    const patterns = Array.from(this.patterns.values());
    return type ? patterns.filter(p => p.type === type) : patterns;
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): DetectedPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Check if current context matches any patterns
   */
  matchPatterns(type: PatternType, data: any, minConfidence: number = 0.5): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const patterns = this.getPatterns(type);

    for (const pattern of patterns) {
      if (pattern.confidenceScore < minConfidence) continue;

      const score = this.calculateMatchScore(pattern, data);
      if (score >= 0.7) {
        matches.push({
          pattern,
          matchScore: score,
          matchedAt: new Date(),
          context: JSON.stringify(data),
        });

        this.emit('pattern:matched', { pattern, score });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get pattern statistics
   */
  getStatistics(): {
    totalPatterns: number;
    byType: Map<PatternType, number>;
    byConfidence: Map<ConfidenceLevel, number>;
    totalObservations: number;
  } {
    const byType = new Map<PatternType, number>();
    const byConfidence = new Map<ConfidenceLevel, number>();

    for (const pattern of this.patterns.values()) {
      byType.set(pattern.type, (byType.get(pattern.type) || 0) + 1);
      byConfidence.set(pattern.confidence, (byConfidence.get(pattern.confidence) || 0) + 1);
    }

    return {
      totalPatterns: this.patterns.size,
      byType,
      byConfidence,
      totalObservations: this.observations.length,
    };
  }

  /**
   * Clear old observations
   */
  clearOldObservations(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.observations = this.observations.filter(
      obs => obs.timestamp.getTime() > cutoff
    );
  }

  /**
   * Add an observation
   */
  private addObservation(type: PatternType, data: any, context: string): void {
    this.observations.push({
      timestamp: new Date(),
      type,
      data,
      context,
    });

    // Keep observations within limit
    if (this.observations.length > this.maxObservations) {
      this.observations = this.observations.slice(-this.maxObservations);
    }

    this.emit('observation:added', { type, context });
  }

  /**
   * Analyze observations for patterns
   */
  private analyzePatterns(type: PatternType): void {
    const typeObservations = this.observations.filter(obs => obs.type === type);

    if (typeObservations.length < this.minOccurrences) return;

    // Group similar observations
    const groups = this.groupSimilarObservations(typeObservations);

    for (const group of groups) {
      if (group.length >= this.minOccurrences) {
        const pattern = this.createOrUpdatePattern(type, group);
        this.patterns.set(pattern.id, pattern);
        this.emit('pattern:detected', pattern);
      }
    }
  }

  /**
   * Group similar observations
   */
  private groupSimilarObservations(observations: PatternObservation[]): PatternObservation[][] {
    const groups: PatternObservation[][] = [];

    for (const obs of observations) {
      let foundGroup = false;

      for (const group of groups) {
        if (this.areSimilar(obs, group[0])) {
          group.push(obs);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        groups.push([obs]);
      }
    }

    return groups;
  }

  /**
   * Check if two observations are similar
   */
  private areSimilar(obs1: PatternObservation, obs2: PatternObservation): boolean {
    if (obs1.type !== obs2.type) return false;

    const similarity = this.calculateSimilarity(obs1.data, obs2.data);
    return similarity > 0.7;
  }

  /**
   * Calculate similarity between two data objects
   */
  private calculateSimilarity(data1: any, data2: any): number {
    const str1 = JSON.stringify(data1);
    const str2 = JSON.stringify(data2);

    // Simple Jaccard similarity on tokens
    const tokens1 = new Set(str1.toLowerCase().match(/\w+/g) || []);
    const tokens2 = new Set(str2.toLowerCase().match(/\w+/g) || []);

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Create or update a pattern from observation group
   */
  private createOrUpdatePattern(type: PatternType, group: PatternObservation[]): DetectedPattern {
    const id = this.generatePatternId(type, group);
    const existing = this.patterns.get(id);

    const occurrences = group.length;
    const confidence = this.calculateConfidence(occurrences);
    const confidenceScore = this.calculateConfidenceScore(occurrences);

    const examples: PatternExample[] = group.slice(0, 5).map(obs => ({
      timestamp: obs.timestamp,
      context: obs.context,
      excerpt: JSON.stringify(obs.data).slice(0, 200),
      relevance: 1.0,
    }));

    const pattern: DetectedPattern = {
      id,
      type,
      name: this.generatePatternName(type, group),
      description: this.generatePatternDescription(type, group),
      occurrences: existing ? existing.occurrences + occurrences : occurrences,
      confidence,
      confidenceScore,
      firstSeen: existing?.firstSeen || group[0].timestamp,
      lastSeen: group[group.length - 1].timestamp,
      examples,
      metadata: this.extractMetadata(group),
      tags: this.generateTags(type, group),
    };

    return pattern;
  }

  /**
   * Generate pattern ID
   */
  private generatePatternId(type: PatternType, group: PatternObservation[]): string {
    const signature = JSON.stringify(group[0].data);
    const hash = this.simpleHash(signature);
    return `${type}_${hash}`;
  }

  /**
   * Generate pattern name
   */
  private generatePatternName(type: PatternType, group: PatternObservation[]): string {
    switch (type) {
      case PatternType.CODE_STRUCTURE:
        return `Code structure pattern (${group[0].data.language || 'unknown'})`;
      case PatternType.USER_WORKFLOW:
        return `Workflow: ${group[0].data.action}`;
      case PatternType.ERROR_SEQUENCE:
        return `Error pattern: ${group[0].data.errorType}`;
      case PatternType.CONVERSATION_FLOW:
        return `Conversation pattern: ${group[0].data.intent}`;
      case PatternType.FILE_ACCESS:
        return `File access: ${group[0].data.operation} ${group[0].data.fileType}`;
      case PatternType.TOOL_USAGE:
        return `Tool usage: ${group[0].data.toolName}`;
      default:
        return `Pattern (${type})`;
    }
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(type: PatternType, group: PatternObservation[]): string {
    return `Detected pattern from ${group.length} similar occurrences`;
  }

  /**
   * Extract metadata from observation group
   */
  private extractMetadata(group: PatternObservation[]): Record<string, any> {
    return {
      sampleSize: group.length,
      avgTimeBetween: this.calculateAvgTimeBetween(group),
      contexts: [...new Set(group.map(g => g.context))],
    };
  }

  /**
   * Generate tags for pattern
   */
  private generateTags(type: PatternType, group: PatternObservation[]): string[] {
    const tags = [type as string];

    if (group.length >= 10) tags.push('frequent');
    if (group.length >= 5 && group.length < 10) tags.push('moderate');
    if (group.length < 5) tags.push('rare');

    return tags;
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(occurrences: number): ConfidenceLevel {
    if (occurrences >= 10) return ConfidenceLevel.VERY_HIGH;
    if (occurrences >= 7) return ConfidenceLevel.HIGH;
    if (occurrences >= 5) return ConfidenceLevel.MEDIUM;
    return ConfidenceLevel.LOW;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(occurrences: number): number {
    return Math.min(occurrences / 10, 1.0);
  }

  /**
   * Calculate average time between occurrences
   */
  private calculateAvgTimeBetween(group: PatternObservation[]): number {
    if (group.length < 2) return 0;

    let totalTime = 0;
    for (let i = 1; i < group.length; i++) {
      totalTime += group[i].timestamp.getTime() - group[i - 1].timestamp.getTime();
    }

    return totalTime / (group.length - 1);
  }

  /**
   * Calculate match score
   */
  private calculateMatchScore(pattern: DetectedPattern, data: any): number {
    // Use the first example as reference
    if (pattern.examples.length === 0) return 0;

    const referenceData = JSON.parse(pattern.examples[0].excerpt);
    return this.calculateSimilarity(referenceData, data);
  }

  /**
   * Extract code structure
   */
  private extractCodeStructure(code: string): any {
    return {
      hasClasses: /class\s+\w+/.test(code),
      hasFunctions: /function\s+\w+|const\s+\w+\s*=\s*\(/.test(code),
      hasImports: /import\s+/.test(code),
      hasExports: /export\s+/.test(code),
      lines: code.split('\n').length,
    };
  }

  /**
   * Detect programming language
   */
  private detectLanguage(code: string): string {
    if (/import.*from/.test(code)) return 'javascript/typescript';
    if (/def\s+\w+\(/.test(code)) return 'python';
    if (/fn\s+\w+\(/.test(code)) return 'rust';
    if (/func\s+\w+\(/.test(code)) return 'go';
    return 'unknown';
  }

  /**
   * Classify error type
   */
  private classifyError(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('syntax')) return 'syntax';
    if (lower.includes('type')) return 'type';
    if (lower.includes('reference')) return 'reference';
    if (lower.includes('network')) return 'network';
    if (lower.includes('permission')) return 'permission';
    return 'unknown';
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): string {
    const lower = message.toLowerCase();
    if (lower.startsWith('create') || lower.startsWith('add')) return 'create';
    if (lower.startsWith('fix') || lower.startsWith('debug')) return 'fix';
    if (lower.startsWith('explain') || lower.startsWith('what')) return 'explain';
    if (lower.startsWith('update') || lower.startsWith('change')) return 'update';
    if (lower.startsWith('delete') || lower.startsWith('remove')) return 'delete';
    return 'other';
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Load patterns from disk
   */
  private async loadPatterns(): Promise<void> {
    try {
      const dir = path.dirname(this.patternsFile);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.patternsFile, 'utf-8');
      const data = JSON.parse(content);

      for (const patternData of data) {
        const pattern: DetectedPattern = {
          ...patternData,
          firstSeen: new Date(patternData.firstSeen),
          lastSeen: new Date(patternData.lastSeen),
          examples: patternData.examples.map((ex: any) => ({
            ...ex,
            timestamp: new Date(ex.timestamp),
          })),
        };
        this.patterns.set(pattern.id, pattern);
      }
    } catch {
      // File doesn't exist yet
      this.patterns.clear();
    }
  }

  /**
   * Save patterns to disk
   */
  async savePatterns(): Promise<void> {
    const dir = path.dirname(this.patternsFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.patternsFile,
      JSON.stringify(Array.from(this.patterns.values()), null, 2)
    );
  }
}

// Singleton instance
let patternRecognitionInstance: PatternRecognition | null = null;

/**
 * Get the global pattern recognition system
 */
export function getPatternRecognition(): PatternRecognition {
  if (!patternRecognitionInstance) {
    patternRecognitionInstance = new PatternRecognition();
  }
  return patternRecognitionInstance;
}
