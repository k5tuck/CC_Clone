/**
 * LLM Context Builder
 * Builds comprehensive context for LLM that includes all validation systems,
 * file inventory, and constraints to prevent "ghost file" issues
 */

import { ProjectContextLoader } from '../context/ProjectContextLoader';
import { getFileAccessTracker } from '../tools/toolFunctions';
import { KnowledgeGraph } from '../knowledge/KnowledgeGraph';
import { ImpactAnalyzer } from '../knowledge/ImpactAnalyzer';
import { PatternRecognition } from '../patterns/PatternRecognition';
import { RollbackManager, ChangeAction } from '../rollback/RollbackManager';

export interface LLMContext {
  // Project structure
  projectInventory: string;
  totalFiles: number;
  filesByType: Record<string, number>;

  // Session state
  filesReadThisSession: string[];
  filesModifiedThisSession: string[];
  filesCreatedThisSession: string[];

  // Validation rules
  validationRules: string;

  // Knowledge graph state
  knowledgeGraphStats?: {
    entities: number;
    relationships: number;
    recentPatterns: string[];
  };

  // Safety constraints
  constraints: string;
}

export interface ContextOptions {
  includeFileInventory?: boolean;
  includeKnowledgeGraph?: boolean;
  includePatterns?: boolean;
  includeValidationRules?: boolean;
  maxFiles?: number;
}

/**
 * Type-safe interface for FileAccessTracker
 * This matches the actual implementation in toolFunctions.ts
 */
interface FileAccessTrackerInterface {
  markAsRead(filePath: string): void;
  hasBeenRead(filePath: string): boolean;
  fileExists(filePath: string): Promise<boolean>;
  reset(): void;
  getStats(): { readFiles: number; sessionId: string };
}

/**
 * Helper to safely extract read files from tracker
 * Uses reflection to access private property in a type-safe way
 */
function getReadFilesFromTracker(tracker: FileAccessTrackerInterface): string[] {
  // The tracker has a private readFiles Set<string> property
  // We access it using type assertion only after ensuring type safety
  const trackerWithPrivate = tracker as FileAccessTrackerInterface & { 
    readFiles?: Set<string> 
  };
  
  if (trackerWithPrivate.readFiles && trackerWithPrivate.readFiles instanceof Set) {
    return Array.from(trackerWithPrivate.readFiles);
  }
  
  return [];
}

/**
 * Builds comprehensive context for LLM operations
 */
export class LLMContextBuilder {
  constructor(
    private projectContext: ProjectContextLoader,
    private knowledgeGraph?: KnowledgeGraph,
    private patternRecognition?: PatternRecognition,
    private rollbackManager?: RollbackManager
  ) {}

  /**
   * Build complete LLM context with all validation and inventory information
   */
  async buildContext(options: ContextOptions = {}): Promise<LLMContext> {
    const {
      includeFileInventory = true,
      includeKnowledgeGraph = true,
      includePatterns = true,
      includeValidationRules = true,
      maxFiles = 100,
    } = options;

    // Load project structure
    const projectStructure = await this.projectContext.loadProjectStructure();
    const summary = await this.projectContext.generateContextSummary();

    // Get session state - now type-safe!
    const fileAccessTracker = getFileAccessTracker();
    const filesReadThisSession = getReadFilesFromTracker(fileAccessTracker);

    const recentChanges = this.rollbackManager?.getHistory(20) || [];
    const filesModifiedThisSession = recentChanges
      .filter(c => c.action === ChangeAction.MODIFY)
      .map(c => c.filePath);
    const filesCreatedThisSession = recentChanges
      .filter(c => c.action === ChangeAction.CREATE)
      .map(c => c.filePath);

    // Build project inventory
    const projectInventory = this.buildProjectInventory(
      projectStructure,
      maxFiles
    );

    // Build validation rules
    const validationRules = includeValidationRules
      ? this.buildValidationRules()
      : '';

    // Get knowledge graph stats
    let knowledgeGraphStats;
    if (includeKnowledgeGraph && this.knowledgeGraph) {
      const stats = this.knowledgeGraph.getStats();
      const recentPatterns = includePatterns && this.patternRecognition
        ? this.patternRecognition.getPatterns().slice(0, 5).map(p => p.name)
        : [];

      knowledgeGraphStats = {
        entities: stats.nodeCount,
        relationships: stats.edgeCount,
        recentPatterns,
      };
    }

    // Build constraints
    const constraints = this.buildConstraints();

    return {
      projectInventory,
      totalFiles: projectStructure.files.length,
      filesByType: projectStructure.summary.fileTypes,
      filesReadThisSession,
      filesModifiedThisSession,
      filesCreatedThisSession,
      validationRules,
      knowledgeGraphStats,
      constraints,
    };
  }

  /**
   * Generate LLM system prompt with complete context
   */
  async buildSystemPrompt(options: ContextOptions = {}): Promise<string> {
    const context = await this.buildContext(options);

    return `
# PROJECT CONTEXT AND VALIDATION RULES

You are working in a controlled development environment with strict file operation rules.

## PROJECT INVENTORY

${context.projectInventory}

**Total Files:** ${context.totalFiles}
**Files by Type:**
${Object.entries(context.filesByType)
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}

## CURRENT SESSION STATE

**Files Read This Session (${context.filesReadThisSession.length}):**
${context.filesReadThisSession.length > 0
  ? context.filesReadThisSession.slice(0, 20).map(f => `  ✓ ${f}`).join('\n')
  : '  (None yet)'}
${context.filesReadThisSession.length > 20
  ? `  ... and ${context.filesReadThisSession.length - 20} more`
  : ''}

**Files Modified This Session (${context.filesModifiedThisSession.length}):**
${context.filesModifiedThisSession.length > 0
  ? context.filesModifiedThisSession.map(f => `  ✎ ${f}`).join('\n')
  : '  (None yet)'}

**Files Created This Session (${context.filesCreatedThisSession.length}):**
${context.filesCreatedThisSession.length > 0
  ? context.filesCreatedThisSession.map(f => `  ✓ ${f}`).join('\n')
  : '  (None yet)'}

${context.knowledgeGraphStats ? `
## KNOWLEDGE GRAPH STATE

**Entities Tracked:** ${context.knowledgeGraphStats.entities}
**Relationships Tracked:** ${context.knowledgeGraphStats.relationships}
${context.knowledgeGraphStats.recentPatterns.length > 0 ? `
**Recent Patterns Detected:**
${context.knowledgeGraphStats.recentPatterns.map(p => `  - ${p}`).join('\n')}
` : ''}
` : ''}

## CRITICAL FILE OPERATION RULES

${context.validationRules}

## SAFETY CONSTRAINTS

${context.constraints}

## REQUIRED WORKFLOW

When performing file operations, ALWAYS follow this workflow:

1. **VERIFY FILE EXISTS** in the Project Inventory above
   - If file is NOT in the inventory, it might be a typo or new file
   - For new files, explicitly state: "Creating NEW file: <path>"

2. **CHECK SESSION STATE**
   - To MODIFY existing files, they must be in "Files Read This Session"
   - If not read yet, use the Read tool first

3. **ASSESS IMPACT** (for modifications/deletions)
   - Consider which files depend on the target file
   - Check if modifications will break dependencies

4. **EXECUTE WITH CAUTION**
   - Use exact file paths from the inventory
   - Double-check file paths before writing
   - NEVER assume a file exists without verification

5. **TRACK CHANGES**
   - All modifications are automatically tracked
   - You can request rollback if needed

## WHEN IN DOUBT

- Use file search tools to verify paths
- Ask the user for confirmation
- Suggest alternatives if file doesn't exist
- NEVER proceed with unverified file paths

Remember: These rules exist to prevent accidental file operations and ensure code quality.
`;
  }

  /**
   * Build project inventory section
   */
  private buildProjectInventory(
    projectStructure: any,
    maxFiles: number
  ): string {
    const files = projectStructure.files
      .sort((a: any, b: any) => {
        // Sort by directory depth, then name
        const depthA = a.path.split('/').length;
        const depthB = b.path.split('/').length;
        if (depthA !== depthB) return depthA - depthB;
        return a.path.localeCompare(b.path);
      })
      .slice(0, maxFiles);

    // Group by directory
    const filesByDir = new Map<string, any[]>();
    for (const file of files) {
      const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '.';
      if (!filesByDir.has(dir)) {
        filesByDir.set(dir, []);
      }
      filesByDir.get(dir)!.push(file);
    }

    let inventory = '**Available Files:**\n\n';
    for (const [dir, dirFiles] of Array.from(filesByDir.entries()).sort()) {
      inventory += `📁 ${dir}/\n`;
      for (const file of dirFiles) {
        const icon = this.getFileIcon(file);
        const name = file.path.substring(file.path.lastIndexOf('/') + 1);
        inventory += `  ${icon} ${name}\n`;
      }
    }

    if (projectStructure.files.length > maxFiles) {
      inventory += `\n... and ${projectStructure.files.length - maxFiles} more files\n`;
      inventory += `Use file search tools to find specific files not listed above.\n`;
    }

    return inventory;
  }

  /**
   * Build validation rules section
   */
  private buildValidationRules(): string {
    return `
### Read-Before-Write Validation (ACTIVE)
- You CANNOT modify existing files without reading them first
- Reading a file adds it to "Files Read This Session"
- Only files in that list can be modified

### New File Creation Rules
- Creating NEW files requires explicit user confirmation
- State clearly: "This is a NEW file: <path>"
- Provide justification for why the file is needed

### File Existence Validation (ACTIVE)
- All file operations check if files exist
- Operations on non-existent files will fail
- Use file search to verify paths if uncertain

### Permission Validation (ACTIVE)
- File operations are risk-assessed automatically
- High-risk operations require confirmation
- Dangerous operations (delete, move) have extra safeguards
`;
  }

  /**
   * Build constraints section
   */
  private buildConstraints(): string {
    return `
❌ **PROHIBITED ACTIONS:**
- Writing to files not in "Files Read This Session" (except new files with confirmation)
- Assuming files exist without checking the inventory
- Modifying system files outside the project directory
- Deleting files without explicit user request

✅ **REQUIRED ACTIONS:**
- Always check file inventory before operations
- Read files before modifying them
- Verify file paths match inventory exactly
- Ask for confirmation when uncertain

⚠️ **WARNING SIGNS (indicate you might be doing something wrong):**
- You're referencing a file not in the inventory
- You're trying to write without reading first
- You're creating files without user request
- You're assuming directory structures exist

If you see these warning signs, STOP and verify with the user.
`;
  }

  /**
   * Get icon for file type
   */
  private getFileIcon(file: any): string {
    const ext = file.path.substring(file.path.lastIndexOf('.') + 1);
    const icons: Record<string, string> = {
      ts: '📘',
      tsx: '⚛️',
      js: '📜',
      jsx: '⚛️',
      json: '📋',
      md: '📝',
      py: '🐍',
      go: '🔷',
      rs: '🦀',
      java: '☕',
      cpp: '⚙️',
      c: '⚙️',
      html: '🌐',
      css: '🎨',
      yaml: '⚙️',
      yml: '⚙️',
      txt: '📄',
    };
    return icons[ext] || '📄';
  }

  /**
   * Build minimal context for quick operations
   */
  async buildQuickContext(): Promise<string> {
    const fileAccessTracker = getFileAccessTracker();
    const filesRead = getReadFilesFromTracker(fileAccessTracker);

    return `
# Quick Context

Files read this session: ${filesRead.length}
${filesRead.length > 0 ? `\nRecent files:\n${filesRead.slice(-5).map(f => `  - ${f}`).join('\n')}` : ''}

Remember: You can only modify files you've read. Use Read tool first.
`;
  }

  /**
   * Generate context update after operations
   */
  async buildContextUpdate(operation: string, filePath: string): Promise<string> {
    const fileAccessTracker = getFileAccessTracker();
    const filesRead = getReadFilesFromTracker(fileAccessTracker);

    return `
# Context Updated

Operation: ${operation}
File: ${filePath}

Files now readable for modification: ${filesRead.length}

${filesRead.includes(filePath)
  ? `✓ ${filePath} is now in your read list and can be modified`
  : `ℹ ${filePath} is not yet read - use Read tool first to modify it`}
`;
  }
}

/**
 * Helper to inject context into LLM prompts
 */
export function injectLLMContext(
  basePrompt: string,
  context: string
): string {
  return `${context}

---

${basePrompt}`;
}