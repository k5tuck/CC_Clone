/**
 * Systematic Thinking System
 * Provides structured thinking prompts and parsing for LLM responses
 */

import { EventEmitter } from 'events';

/**
 * Thinking phase
 */
export enum ThinkingPhase {
  ANALYSIS = 'analysis',
  PLANNING = 'planning',
  EXECUTION = 'execution',
  VERIFICATION = 'verification',
  REFLECTION = 'reflection',
}

/**
 * Thinking block
 */
export interface ThinkingBlock {
  phase: ThinkingPhase;
  content: string;
  timestamp: Date;
}

/**
 * Structured response
 */
export interface StructuredResponse {
  thinking: ThinkingBlock[];
  actions: ActionStep[];
  toolUsage: ToolUsageExplanation[];
  progress: ProgressUpdate[];
  finalResponse: string;
}

/**
 * Action step
 */
export interface ActionStep {
  step: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning: string;
}

/**
 * Tool usage explanation
 */
export interface ToolUsageExplanation {
  tool: string;
  purpose: string;
  expectedOutcome: string;
  actualOutcome?: string;
}

/**
 * Progress update
 */
export interface ProgressUpdate {
  message: string;
  percentComplete: number;
  timestamp: Date;
}

/**
 * Systematic Thinking System
 */
export class SystematicThinking extends EventEmitter {
  /**
   * Get the systematic thinking prompt
   */
  getSystemPrompt(): string {
    return `
You are a systematic thinking AI assistant. When responding to user requests, you MUST follow this structured approach:

## 1. ANALYSIS PHASE
First, analyze the request by:
- Understanding the user's intent
- Identifying key requirements
- Recognizing potential challenges
- Determining what information you need

Output your analysis in a <thinking phase="analysis"> block:
<thinking phase="analysis">
Your analysis here...
</thinking>

## 2. PLANNING PHASE
Create a concrete plan by:
- Breaking down the task into specific steps
- Identifying which tools you'll need
- Anticipating potential issues
- Estimating complexity

Output your plan in a <thinking phase="planning"> block:
<thinking phase="planning">
Your plan here...
Step 1: ...
Step 2: ...
Step 3: ...
</thinking>

## 3. EXECUTION PHASE
Execute your plan systematically:
- Perform each step in order
- Use tools appropriately
- Explain what you're doing as you go
- Handle errors gracefully

For each tool use, explain:
<tool-explanation tool="ToolName">
Purpose: Why I'm using this tool
Expected outcome: What I expect to achieve
</tool-explanation>

Then use the tool.

After the tool completes, reflect:
<tool-result tool="ToolName">
Actual outcome: What actually happened
Next steps: What I'll do based on this result
</tool-result>

## 4. VERIFICATION PHASE
After execution, verify your work:
- Check that requirements are met
- Validate outputs are correct
- Identify any remaining issues
- Consider edge cases

Output verification in a <thinking phase="verification"> block:
<thinking phase="verification">
Your verification here...
</thinking>

## 5. REFLECTION PHASE (if relevant)
Reflect on the process:
- What went well
- What could be improved
- Lessons learned
- Suggestions for the user

Output reflection in a <thinking phase="reflection"> block:
<thinking phase="reflection">
Your reflection here...
</thinking>

## PROGRESS UPDATES
Throughout execution, provide progress updates:
<progress percent="25">Starting analysis...</progress>
<progress percent="50">Halfway through execution...</progress>
<progress percent="75">Verifying results...</progress>
<progress percent="100">Task complete!</progress>

## FINAL RESPONSE
End with a clear, concise summary for the user that synthesizes your work.

---

IMPORTANT RULES:
1. ALWAYS include thinking blocks for major phases
2. ALWAYS explain tool usage before and after
3. ALWAYS provide progress updates for long tasks
4. Keep thinking blocks focused and relevant
5. Make your final response user-friendly and actionable
6. If you encounter errors, explain them in thinking blocks
7. If you're uncertain, express it in your thinking

This systematic approach helps users understand your reasoning and builds trust in your responses.
`.trim();
  }

  /**
   * Parse a structured response
   */
  parseStructuredResponse(response: string): StructuredResponse {
    const thinking: ThinkingBlock[] = [];
    const actions: ActionStep[] = [];
    const toolUsage: ToolUsageExplanation[] = [];
    const progress: ProgressUpdate[] = [];

    // Extract thinking blocks
    const thinkingRegex = /<thinking phase="(\w+)">([\s\S]*?)<\/thinking>/g;
    let match;
    while ((match = thinkingRegex.exec(response)) !== null) {
      thinking.push({
        phase: match[1] as ThinkingPhase,
        content: match[2].trim(),
        timestamp: new Date(),
      });
    }

    // Extract tool explanations
    const toolExplRegex = /<tool-explanation tool="([^"]+)">([\s\S]*?)<\/tool-explanation>/g;
    while ((match = toolExplRegex.exec(response)) !== null) {
      const content = match[2].trim();
      const purposeMatch = content.match(/Purpose:\s*(.+)/);
      const expectedMatch = content.match(/Expected outcome:\s*(.+)/);

      toolUsage.push({
        tool: match[1],
        purpose: purposeMatch ? purposeMatch[1].trim() : '',
        expectedOutcome: expectedMatch ? expectedMatch[1].trim() : '',
      });
    }

    // Extract tool results
    const toolResRegex = /<tool-result tool="([^"]+)">([\s\S]*?)<\/tool-result>/g;
    let toolIndex = 0;
    while ((match = toolResRegex.exec(response)) !== null) {
      const content = match[2].trim();
      const actualMatch = content.match(/Actual outcome:\s*(.+)/);

      if (toolUsage[toolIndex]) {
        toolUsage[toolIndex].actualOutcome = actualMatch ? actualMatch[1].trim() : '';
      }
      toolIndex++;
    }

    // Extract progress updates
    const progressRegex = /<progress percent="(\d+)">([\s\S]*?)<\/progress>/g;
    while ((match = progressRegex.exec(response)) !== null) {
      progress.push({
        message: match[2].trim(),
        percentComplete: parseInt(match[1]),
        timestamp: new Date(),
      });
    }

    // Extract action steps from planning phase
    const planningBlock = thinking.find(t => t.phase === ThinkingPhase.PLANNING);
    if (planningBlock) {
      const stepRegex = /Step (\d+):\s*(.+)/g;
      let stepMatch;
      while ((stepMatch = stepRegex.exec(planningBlock.content)) !== null) {
        actions.push({
          step: parseInt(stepMatch[1]),
          description: stepMatch[2].trim(),
          status: 'pending',
          reasoning: '',
        });
      }
    }

    // Extract final response (everything after last thinking/tool block)
    const lastThinkingIndex = response.lastIndexOf('</thinking>');
    const lastToolIndex = response.lastIndexOf('</tool-result>');
    const lastProgressIndex = response.lastIndexOf('</progress>');

    const lastIndex = Math.max(lastThinkingIndex, lastToolIndex, lastProgressIndex);
    const finalResponse = lastIndex > 0
      ? response.slice(lastIndex + (response[lastIndex + 1] === '/' ? 17 : 11)).trim()
      : response;

    return {
      thinking,
      actions,
      toolUsage,
      progress,
      finalResponse,
    };
  }

  /**
   * Format structured response for display
   */
  formatForDisplay(structured: StructuredResponse): string {
    let output = '';

    // Thinking blocks
    if (structured.thinking.length > 0) {
      output += '🤔 THINKING PROCESS:\n\n';
      for (const block of structured.thinking) {
        const icon = this.getPhaseIcon(block.phase);
        output += `${icon} ${block.phase.toUpperCase()}:\n`;
        output += `${block.content}\n\n`;
      }
    }

    // Actions
    if (structured.actions.length > 0) {
      output += '📋 PLANNED ACTIONS:\n\n';
      for (const action of structured.actions) {
        const statusIcon = this.getStatusIcon(action.status);
        output += `${statusIcon} Step ${action.step}: ${action.description}\n`;
      }
      output += '\n';
    }

    // Tool usage
    if (structured.toolUsage.length > 0) {
      output += '🔧 TOOL USAGE:\n\n';
      for (const tool of structured.toolUsage) {
        output += `Tool: ${tool.tool}\n`;
        output += `Purpose: ${tool.purpose}\n`;
        output += `Expected: ${tool.expectedOutcome}\n`;
        if (tool.actualOutcome) {
          output += `Actual: ${tool.actualOutcome}\n`;
        }
        output += '\n';
      }
    }

    // Final response
    if (structured.finalResponse) {
      output += '💬 RESPONSE:\n\n';
      output += structured.finalResponse;
    }

    return output;
  }

  /**
   * Get icon for thinking phase
   */
  private getPhaseIcon(phase: ThinkingPhase): string {
    switch (phase) {
      case ThinkingPhase.ANALYSIS:
        return '🔍';
      case ThinkingPhase.PLANNING:
        return '📋';
      case ThinkingPhase.EXECUTION:
        return '⚙️';
      case ThinkingPhase.VERIFICATION:
        return '✅';
      case ThinkingPhase.REFLECTION:
        return '💭';
      default:
        return '🤔';
    }
  }

  /**
   * Get icon for action status
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending':
        return '⭕';
      case 'in_progress':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⭕';
    }
  }

  /**
   * Create a thinking prompt template
   */
  createPromptTemplate(userMessage: string, context?: string): string {
    return `
${context ? `CONTEXT:\n${context}\n\n` : ''}USER REQUEST:
${userMessage}

Remember to follow the systematic thinking approach:
1. Analyze the request in a <thinking phase="analysis"> block
2. Create a plan in a <thinking phase="planning"> block
3. Execute with tool explanations
4. Verify your work in a <thinking phase="verification"> block
5. Provide a clear final response

Begin your response:
`.trim();
  }

  /**
   * Check if response contains thinking blocks
   */
  hasThinkingBlocks(response: string): boolean {
    return /<thinking phase="\w+">/.test(response);
  }

  /**
   * Extract just the final response (without thinking blocks)
   */
  extractFinalResponse(response: string): string {
    const structured = this.parseStructuredResponse(response);
    return structured.finalResponse;
  }

  /**
   * Get thinking statistics
   */
  getThinkingStats(structured: StructuredResponse) {
    return {
      totalThinkingBlocks: structured.thinking.length,
      phasesCovered: new Set(structured.thinking.map(t => t.phase)).size,
      totalActions: structured.actions.length,
      completedActions: structured.actions.filter(a => a.status === 'completed').length,
      toolsUsed: structured.toolUsage.length,
      hasVerification: structured.thinking.some(t => t.phase === ThinkingPhase.VERIFICATION),
      hasReflection: structured.thinking.some(t => t.phase === ThinkingPhase.REFLECTION),
    };
  }
}

// Singleton instance
let systematicThinkingInstance: SystematicThinking | null = null;

/**
 * Get the global systematic thinking system
 */
export function getSystematicThinking(): SystematicThinking {
  if (!systematicThinkingInstance) {
    systematicThinkingInstance = new SystematicThinking();
  }
  return systematicThinkingInstance;
}
