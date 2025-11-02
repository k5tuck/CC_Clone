# Tool Usage Transparency - Implementation Plan

**Version**: 1.0  
**Date**: 2025-11-01  
**Status**: Draft  

---

## Executive Summary

This document outlines the complete implementation plan for adding **Tool Usage Transparency** to Selek. The feature will provide real-time visibility into tool execution, including parameters, timing, success/failure status, and a comprehensive history view.

### Goals
1. Real-time display of tool calls as they happen
2. Clear visibility into tool parameters and results
3. Performance metrics (timing, success rate)
4. Collapsible UI to avoid clutter
5. Historical tool usage tracking
6. Color-coded visual hierarchy

### Scope
- Tool call event emission system
- Real-time TUI display components
- Timing and metrics tracking
- Collapsible UI elements
- Summary generation after responses
- Tool history storage and `/tools-history` command

---

## Architecture Overview

### Current State Analysis

**Tool Execution Flow:**
```
User Input → StreamingClientWithTools.streamChatWithTools()
  → LLM Decision → Tool Call → executeTool()
  → Tool Result → Continue Loop
```

**Key Files:**
- `/Users/ktuck/Documents/Selek/src/lib/streaming/StreamingClientWithTools.ts` - Tool orchestration
- `/Users/ktuck/Documents/Selek/src/lib/tools/toolFunctions.ts` - Tool implementations
- `/Users/ktuck/Documents/Selek/src/tui/multiagent-tui.tsx` - TUI interface

**Current Visibility:**
- Console logs: `console.log('[Tool] Calling:', toolCall.name, toolCall.arguments)`
- Agent messages: Basic "Tool System" messages added to state
- Limited UI feedback in streaming

---

## Implementation Plan

### Phase 1: Event System Enhancement

#### 1.1 Tool Event Types

**File**: `src/lib/streaming/types/ToolEvents.ts` (NEW)

```typescript
/**
 * Comprehensive tool execution event types
 */

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolName: string;
  parameters: Record<string, any>;
  timestamp: Date;
  callId: string; // Unique identifier for this call
}

export interface ToolCallProgressEvent {
  type: 'tool_call_progress';
  callId: string;
  message: string;
  progress?: number; // 0-100
}

export interface ToolCallCompleteEvent {
  type: 'tool_call_complete';
  callId: string;
  toolName: string;
  result: any;
  duration: number; // milliseconds
  success: true;
  timestamp: Date;
}

export interface ToolCallErrorEvent {
  type: 'tool_call_error';
  callId: string;
  toolName: string;
  error: Error | string;
  duration: number;
  success: false;
  timestamp: Date;
}

export type ToolExecutionEvent = 
  | ToolCallStartEvent
  | ToolCallProgressEvent
  | ToolCallCompleteEvent
  | ToolCallErrorEvent;

/**
 * Tool call record for history
 */
export interface ToolCallRecord {
  callId: string;
  toolName: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  conversationId?: string;
}

/**
 * Tool execution summary
 */
export interface ToolExecutionSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  toolsUsed: string[];
  totalDuration: number;
  averageDuration: number;
  byTool: Record<string, {
    count: number;
    success: number;
    failed: number;
    avgDuration: number;
  }>;
}
```

#### 1.2 Enhanced StreamingClientWithTools

**File**: `src/lib/streaming/StreamingClientWithTools.ts` (MODIFY)

**Changes:**
1. Import event types
2. Add event emitter capability
3. Generate unique call IDs
4. Emit events at each stage
5. Track timing internally

```typescript
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ToolExecutionEvent,
  ToolCallStartEvent,
  ToolCallCompleteEvent,
  ToolCallErrorEvent,
  ToolCallRecord,
} from './types/ToolEvents';

export class StreamingClientWithTools extends EventEmitter {
  private tools: Map<string, ToolFunction>;
  private toolSchemas: Tool[];
  private maxIterations: number;
  private toolCallHistory: ToolCallRecord[] = [];

  constructor(
    private readonly streamingClient: IStreamingClient,
    maxIterations: number = 10
  ) {
    super(); // EventEmitter constructor
    this.tools = new Map();
    this.toolSchemas = [];
    this.maxIterations = maxIterations;
  }

  /**
   * Execute a tool with full event emission
   */
  private async executeTool(toolCall: ToolCall): Promise<any> {
    const callId = uuidv4();
    const startTime = Date.now();

    // Emit start event
    const startEvent: ToolCallStartEvent = {
      type: 'tool_call_start',
      toolName: toolCall.name,
      parameters: toolCall.arguments,
      timestamp: new Date(),
      callId,
    };
    this.emit('tool_event', startEvent);

    const func = this.tools.get(toolCall.name);
    
    if (!func) {
      const error = new StreamingToolError(
        `Tool not found: ${toolCall.name}`,
        toolCall.name,
        { availableTools: Array.from(this.tools.keys()) }
      );
      
      const duration = Date.now() - startTime;
      const errorEvent: ToolCallErrorEvent = {
        type: 'tool_call_error',
        callId,
        toolName: toolCall.name,
        error,
        duration,
        success: false,
        timestamp: new Date(),
      };
      this.emit('tool_event', errorEvent);

      // Record in history
      this.toolCallHistory.push({
        callId,
        toolName: toolCall.name,
        parameters: toolCall.arguments,
        error: error.message,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        success: false,
      });

      throw error;
    }

    try {
      const result = await func(toolCall.arguments);
      const duration = Date.now() - startTime;

      // Emit complete event
      const completeEvent: ToolCallCompleteEvent = {
        type: 'tool_call_complete',
        callId,
        toolName: toolCall.name,
        result,
        duration,
        success: true,
        timestamp: new Date(),
      };
      this.emit('tool_event', completeEvent);

      // Record in history
      this.toolCallHistory.push({
        callId,
        toolName: toolCall.name,
        parameters: toolCall.arguments,
        result,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const toolError = new StreamingToolError(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        toolCall.name,
        { arguments: toolCall.arguments, error }
      );

      // Emit error event
      const errorEvent: ToolCallErrorEvent = {
        type: 'tool_call_error',
        callId,
        toolName: toolCall.name,
        error: toolError,
        duration,
        success: false,
        timestamp: new Date(),
      };
      this.emit('tool_event', errorEvent);

      // Record in history
      this.toolCallHistory.push({
        callId,
        toolName: toolCall.name,
        parameters: toolCall.arguments,
        error: toolError.message,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration,
        success: false,
      });

      throw toolError;
    }
  }

  /**
   * Get tool call history
   */
  getToolHistory(): ToolCallRecord[] {
    return [...this.toolCallHistory];
  }

  /**
   * Get tool execution summary
   */
  getToolSummary(): ToolExecutionSummary {
    const totalCalls = this.toolCallHistory.length;
    const successfulCalls = this.toolCallHistory.filter(r => r.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const toolsUsed = [...new Set(this.toolCallHistory.map(r => r.toolName))];
    const totalDuration = this.toolCallHistory.reduce((sum, r) => sum + (r.duration || 0), 0);
    const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const byTool: Record<string, any> = {};
    for (const tool of toolsUsed) {
      const records = this.toolCallHistory.filter(r => r.toolName === tool);
      byTool[tool] = {
        count: records.length,
        success: records.filter(r => r.success).length,
        failed: records.filter(r => !r.success).length,
        avgDuration: records.reduce((sum, r) => sum + (r.duration || 0), 0) / records.length,
      };
    }

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      toolsUsed,
      totalDuration,
      averageDuration,
      byTool,
    };
  }

  /**
   * Clear tool history
   */
  clearToolHistory(): void {
    this.toolCallHistory = [];
  }
}
```

---

### Phase 2: TUI Display Components

#### 2.1 Tool Call Display Component

**File**: `src/tui/components/ToolCallDisplay.tsx` (NEW)

```typescript
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ToolCallRecord } from '../../lib/streaming/types/ToolEvents';

export interface ToolCallDisplayProps {
  record: ToolCallRecord;
  isActive: boolean; // Currently executing
  isExpanded?: boolean;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  record,
  isActive,
  isExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(isExpanded);

  const getToolColor = (toolName: string): string => {
    const colorMap: Record<string, string> = {
      readFile: 'blue',
      writeFile: 'green',
      searchFiles: 'cyan',
      blobSearch: 'magenta',
      bashExec: 'yellow',
      queryKnowledgeGraph: 'purple',
      getFileContext: 'blue',
      getAgentHistory: 'cyan',
      storeKnowledge: 'green',
      findRelatedEntities: 'magenta',
    };
    return colorMap[toolName] || 'white';
  };

  const getStatusIcon = (): string => {
    if (isActive) return '⏳';
    if (record.success) return '✅';
    return '❌';
  };

  const getStatusColor = (): string => {
    if (isActive) return 'yellow';
    if (record.success) return 'green';
    return 'red';
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '...';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatParams = (params: Record<string, any>): string => {
    // Truncate long values for compact display
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 50) {
        formatted[key] = value.slice(0, 50) + '...';
      } else {
        formatted[key] = value;
      }
    }
    return JSON.stringify(formatted, null, 2);
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={getToolColor(record.toolName)} paddingX={1} marginY={0}>
      {/* Header - always visible */}
      <Box>
        <Text color={getStatusColor()}>{getStatusIcon()}</Text>
        <Text> </Text>
        <Text color={getToolColor(record.toolName)} bold>
          {record.toolName}
        </Text>
        <Text color="gray"> • </Text>
        <Text color="gray">{formatDuration(record.duration)}</Text>
        {expanded ? (
          <Text color="cyan"> ▼</Text>
        ) : (
          <Text color="gray"> ▶</Text>
        )}
      </Box>

      {/* Expanded details */}
      {expanded && (
        <Box flexDirection="column" paddingLeft={2} paddingTop={1}>
          <Box>
            <Text color="gray" bold>Parameters:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="white">{formatParams(record.parameters)}</Text>
          </Box>

          {record.success && record.result && (
            <>
              <Box marginTop={1}>
                <Text color="gray" bold>Result:</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="green">{JSON.stringify(record.result, null, 2).slice(0, 200)}</Text>
              </Box>
            </>
          )}

          {!record.success && record.error && (
            <>
              <Box marginTop={1}>
                <Text color="gray" bold>Error:</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="red">{record.error}</Text>
              </Box>
            </>
          )}

          <Box marginTop={1}>
            <Text color="gray">
              Started: {record.startTime.toLocaleTimeString()}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
```

#### 2.2 Tool Execution Panel Component

**File**: `src/tui/components/ToolExecutionPanel.tsx` (NEW)

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { ToolCallRecord } from '../../lib/streaming/types/ToolEvents';
import { ToolCallDisplay } from './ToolCallDisplay';

export interface ToolExecutionPanelProps {
  activeToolCalls: ToolCallRecord[];
  recentToolCalls: ToolCallRecord[];
  showPanel: boolean;
}

export const ToolExecutionPanel: React.FC<ToolExecutionPanelProps> = ({
  activeToolCalls,
  recentToolCalls,
  showPanel,
}) => {
  if (!showPanel && activeToolCalls.length === 0) {
    return null;
  }

  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="cyan" 
      paddingX={1} 
      marginBottom={1}
    >
      <Box>
        <Text bold color="cyan">🔧 Tool Execution</Text>
        {activeToolCalls.length > 0 && (
          <>
            <Text color="gray"> • </Text>
            <Text color="yellow">{activeToolCalls.length} active</Text>
          </>
        )}
      </Box>

      {/* Active tool calls */}
      {activeToolCalls.map((record) => (
        <Box key={record.callId} marginTop={1}>
          <ToolCallDisplay record={record} isActive={true} isExpanded={true} />
        </Box>
      ))}

      {/* Recent completed calls */}
      {showPanel && recentToolCalls.length > 0 && (
        <>
          <Box marginTop={1}>
            <Text color="gray" bold>Recent:</Text>
          </Box>
          {recentToolCalls.slice(-5).map((record) => (
            <Box key={record.callId} marginTop={1}>
              <ToolCallDisplay record={record} isActive={false} isExpanded={false} />
            </Box>
          ))}
        </>
      )}
    </Box>
  );
};
```

#### 2.3 Tool Summary Component

**File**: `src/tui/components/ToolSummary.tsx` (NEW)

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { ToolExecutionSummary } from '../../lib/streaming/types/ToolEvents';

export interface ToolSummaryProps {
  summary: ToolExecutionSummary;
}

export const ToolSummary: React.FC<ToolSummaryProps> = ({ summary }) => {
  if (summary.totalCalls === 0) {
    return null;
  }

  const successRate = (summary.successfulCalls / summary.totalCalls) * 100;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="magenta" 
      paddingX={1} 
      marginY={1}
    >
      <Box>
        <Text bold color="magenta">📊 Tool Usage Summary</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Total Calls: </Text>
        <Text color="white">{summary.totalCalls}</Text>
        <Text color="gray"> • Success Rate: </Text>
        <Text color={successRate > 80 ? 'green' : successRate > 50 ? 'yellow' : 'red'}>
          {successRate.toFixed(1)}%
        </Text>
      </Box>

      <Box>
        <Text color="gray">Avg Duration: </Text>
        <Text color="cyan">{summary.averageDuration.toFixed(0)}ms</Text>
        <Text color="gray"> • Total Time: </Text>
        <Text color="cyan">{(summary.totalDuration / 1000).toFixed(2)}s</Text>
      </Box>

      {summary.toolsUsed.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" bold>Tools Used:</Text>
          {summary.toolsUsed.map((tool) => {
            const stats = summary.byTool[tool];
            return (
              <Box key={tool} paddingLeft={2}>
                <Text color="cyan">{tool}</Text>
                <Text color="gray">: </Text>
                <Text color="white">{stats.count}×</Text>
                <Text color="gray"> (</Text>
                <Text color="green">{stats.success}✓</Text>
                {stats.failed > 0 && (
                  <>
                    <Text color="gray">, </Text>
                    <Text color="red">{stats.failed}✗</Text>
                  </>
                )}
                <Text color="gray">) </Text>
                <Text color="gray">~{stats.avgDuration.toFixed(0)}ms</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
```

---

### Phase 3: TUI Integration

#### 3.1 State Management

**File**: `src/tui/multiagent-tui.tsx` (MODIFY)

**Add to AppState interface:**

```typescript
interface AppState {
  // ... existing fields ...

  // Tool tracking
  activeToolCalls: Map<string, ToolCallRecord>;
  completedToolCalls: ToolCallRecord[];
  currentToolSummary: ToolExecutionSummary | null;
  showToolPanel: boolean;
  showToolSummary: boolean;
}
```

**Add to initial state:**

```typescript
const [state, setState] = useState<AppState>({
  // ... existing fields ...
  
  activeToolCalls: new Map(),
  completedToolCalls: [],
  currentToolSummary: null,
  showToolPanel: false,
  showToolSummary: false,
});
```

#### 3.2 Event Subscription

**Add to initialization (useEffect):**

```typescript
// Subscribe to tool events
toolClientRef.current.on('tool_event', (event: ToolExecutionEvent) => {
  if (!mountedRef.current) return;

  switch (event.type) {
    case 'tool_call_start':
      setState(prev => {
        const newActive = new Map(prev.activeToolCalls);
        newActive.set(event.callId, {
          callId: event.callId,
          toolName: event.toolName,
          parameters: event.parameters,
          startTime: event.timestamp,
          success: false,
        });
        return { 
          ...prev, 
          activeToolCalls: newActive,
          showToolPanel: true,
        };
      });
      break;

    case 'tool_call_complete':
      setState(prev => {
        const newActive = new Map(prev.activeToolCalls);
        const record = newActive.get(event.callId);
        newActive.delete(event.callId);

        const completedRecord: ToolCallRecord = {
          ...record!,
          result: event.result,
          endTime: event.timestamp,
          duration: event.duration,
          success: true,
        };

        return {
          ...prev,
          activeToolCalls: newActive,
          completedToolCalls: [...prev.completedToolCalls, completedRecord],
        };
      });
      break;

    case 'tool_call_error':
      setState(prev => {
        const newActive = new Map(prev.activeToolCalls);
        const record = newActive.get(event.callId);
        newActive.delete(event.callId);

        const completedRecord: ToolCallRecord = {
          ...record!,
          error: typeof event.error === 'string' ? event.error : event.error.message,
          endTime: event.timestamp,
          duration: event.duration,
          success: false,
        };

        return {
          ...prev,
          activeToolCalls: newActive,
          completedToolCalls: [...prev.completedToolCalls, completedRecord],
        };
      });
      break;
  }
});
```

#### 3.3 Render Integration

**Add to render function (before Input Area):**

```typescript
{/* Tool Execution Panel */}
{(state.showToolPanel || state.activeToolCalls.size > 0) && (
  <ToolExecutionPanel
    activeToolCalls={Array.from(state.activeToolCalls.values())}
    recentToolCalls={state.completedToolCalls.slice(-10)}
    showPanel={state.showToolPanel}
  />
)}

{/* Tool Summary (shown after response completes) */}
{state.showToolSummary && state.currentToolSummary && (
  <ToolSummary summary={state.currentToolSummary} />
)}
```

#### 3.4 Summary Generation

**Add after streaming completes in handleSubmit:**

```typescript
// After response is done
if (event.type === 'done') {
  // ... existing code ...

  // Generate tool summary
  const summary = toolClientRef.current.getToolSummary();
  if (summary.totalCalls > 0) {
    setState(prev => ({
      ...prev,
      currentToolSummary: summary,
      showToolSummary: true,
    }));
  }

  // Clear summary after 10 seconds
  setTimeout(() => {
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        showToolSummary: false,
        currentToolSummary: null,
      }));
    }
  }, 10000);
}
```

---

### Phase 4: Tool History Command

#### 4.1 History Storage

**File**: `src/lib/history/ToolHistoryManager.ts` (NEW)

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ToolCallRecord } from '../streaming/types/ToolEvents';

export class ToolHistoryManager {
  private historyDir: string;
  private maxRecords: number;

  constructor(historyDir: string = './.tool_history', maxRecords: number = 1000) {
    this.historyDir = historyDir;
    this.maxRecords = maxRecords;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.historyDir, { recursive: true });
  }

  async saveToolCall(record: ToolCallRecord, conversationId: string): Promise<void> {
    const filepath = path.join(this.historyDir, `${conversationId}.json`);
    
    let records: ToolCallRecord[] = [];
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      records = JSON.parse(content);
    } catch (error) {
      // File doesn't exist yet
    }

    records.push(record);

    // Keep only recent records
    if (records.length > this.maxRecords) {
      records = records.slice(-this.maxRecords);
    }

    await fs.writeFile(filepath, JSON.stringify(records, null, 2));
  }

  async getToolHistory(conversationId: string): Promise<ToolCallRecord[]> {
    const filepath = path.join(this.historyDir, `${conversationId}.json`);
    
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  async getAllHistory(): Promise<ToolCallRecord[]> {
    const files = await fs.readdir(this.historyDir);
    const allRecords: ToolCallRecord[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filepath = path.join(this.historyDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const records = JSON.parse(content);
        allRecords.push(...records);
      }
    }

    return allRecords.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async getToolStats(toolName?: string): Promise<any> {
    const allRecords = await this.getAllHistory();
    const filtered = toolName 
      ? allRecords.filter(r => r.toolName === toolName)
      : allRecords;

    const total = filtered.length;
    const successful = filtered.filter(r => r.success).length;
    const failed = total - successful;
    const avgDuration = filtered.reduce((sum, r) => sum + (r.duration || 0), 0) / total;

    const byDay: Record<string, number> = {};
    for (const record of filtered) {
      const day = new Date(record.startTime).toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return {
      total,
      successful,
      failed,
      successRate: (successful / total) * 100,
      avgDuration,
      byDay,
    };
  }
}
```

#### 4.2 /tools-history Command

**Add to handleCommand in multiagent-tui.tsx:**

```typescript
case '/tools-history': {
  if (!toolHistoryManagerRef.current) {
    setState(prev => ({ 
      ...prev, 
      error: 'Tool history manager not initialized' 
    }));
    return true;
  }

  try {
    const args = parts.slice(1);
    const toolName = args[0];

    let historyText = '';

    if (toolName) {
      // Show history for specific tool
      const allHistory = await toolHistoryManagerRef.current.getAllHistory();
      const filtered = allHistory.filter(r => r.toolName === toolName);
      const stats = await toolHistoryManagerRef.current.getToolStats(toolName);

      historyText = `**Tool History: ${toolName}**\n\n`;
      historyText += `Total Calls: ${stats.total}\n`;
      historyText += `Success Rate: ${stats.successRate.toFixed(1)}%\n`;
      historyText += `Avg Duration: ${stats.avgDuration.toFixed(0)}ms\n\n`;
      historyText += `**Recent Calls:**\n`;

      for (const record of filtered.slice(0, 20)) {
        const time = new Date(record.startTime).toLocaleString();
        const status = record.success ? '✅' : '❌';
        const duration = record.duration ? `${record.duration}ms` : 'N/A';
        historyText += `${status} ${time} - ${duration}\n`;
      }
    } else {
      // Show overall history
      const stats = await toolHistoryManagerRef.current.getToolStats();
      const allHistory = await toolHistoryManagerRef.current.getAllHistory();
      const toolsUsed = [...new Set(allHistory.map(r => r.toolName))];

      historyText = `**Overall Tool History**\n\n`;
      historyText += `Total Calls: ${stats.total}\n`;
      historyText += `Success Rate: ${stats.successRate.toFixed(1)}%\n`;
      historyText += `Avg Duration: ${stats.avgDuration.toFixed(0)}ms\n\n`;
      historyText += `**Tools Used:**\n`;

      for (const tool of toolsUsed) {
        const toolStats = await toolHistoryManagerRef.current.getToolStats(tool);
        historyText += `• ${tool}: ${toolStats.total} calls (${toolStats.successRate.toFixed(0)}% success)\n`;
      }

      historyText += `\nUse /tools-history <tool-name> for details`;
    }

    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        { role: 'system', content: historyText } as Message,
      ],
    }));
  } catch (error) {
    setState(prev => ({ 
      ...prev, 
      error: `Failed to load tool history: ${error}` 
    }));
  }
  return true;
}

case '/tools-panel': {
  setState(prev => ({
    ...prev,
    showToolPanel: !prev.showToolPanel,
    messages: [
      ...prev.messages,
      {
        role: 'system',
        content: `Tool panel ${!prev.showToolPanel ? 'enabled' : 'disabled'}`,
      } as Message,
    ],
  }));
  return true;
}
```

---

### Phase 5: Color Coding Scheme

#### 5.1 Tool Categories and Colors

```typescript
// src/lib/streaming/ToolCategories.ts (NEW)

export enum ToolCategory {
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  SEARCH = 'search',
  EXECUTION = 'execution',
  KNOWLEDGE = 'knowledge',
  OTHER = 'other',
}

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  readFile: ToolCategory.FILE_READ,
  writeFile: ToolCategory.FILE_WRITE,
  searchFiles: ToolCategory.SEARCH,
  blobSearch: ToolCategory.SEARCH,
  bashExec: ToolCategory.EXECUTION,
  queryKnowledgeGraph: ToolCategory.KNOWLEDGE,
  getFileContext: ToolCategory.KNOWLEDGE,
  getAgentHistory: ToolCategory.KNOWLEDGE,
  storeKnowledge: ToolCategory.KNOWLEDGE,
  findRelatedEntities: ToolCategory.KNOWLEDGE,
};

export const CATEGORY_COLORS: Record<ToolCategory, string> = {
  [ToolCategory.FILE_READ]: 'blue',
  [ToolCategory.FILE_WRITE]: 'green',
  [ToolCategory.SEARCH]: 'cyan',
  [ToolCategory.EXECUTION]: 'yellow',
  [ToolCategory.KNOWLEDGE]: 'magenta',
  [ToolCategory.OTHER]: 'white',
};

export const CATEGORY_ICONS: Record<ToolCategory, string> = {
  [ToolCategory.FILE_READ]: '📖',
  [ToolCategory.FILE_WRITE]: '✏️',
  [ToolCategory.SEARCH]: '🔍',
  [ToolCategory.EXECUTION]: '⚙️',
  [ToolCategory.KNOWLEDGE]: '🧠',
  [ToolCategory.OTHER]: '🔧',
};

export function getToolCategory(toolName: string): ToolCategory {
  return TOOL_CATEGORIES[toolName] || ToolCategory.OTHER;
}

export function getToolColor(toolName: string): string {
  const category = getToolCategory(toolName);
  return CATEGORY_COLORS[category];
}

export function getToolIcon(toolName: string): string {
  const category = getToolCategory(toolName);
  return CATEGORY_ICONS[category];
}
```

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Input                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            StreamingClientWithTools                         │
│                                                             │
│  streamChatWithTools() ────┐                               │
│                             │                               │
│                             ▼                               │
│                    LLM generates tool call                  │
│                             │                               │
│                             ▼                               │
│  ┌──────────────────────────────────────────────┐          │
│  │  executeTool(toolCall)                       │          │
│  │                                              │          │
│  │  1. Generate callId (UUID)                   │          │
│  │  2. Record startTime                         │          │
│  │  3. Emit 'tool_call_start' ──────────────────┼──────┐   │
│  │  4. Execute tool function                    │      │   │
│  │  5. Record duration                          │      │   │
│  │  6. Emit 'tool_call_complete' or '_error' ───┼──────┤   │
│  │  7. Store in history                         │      │   │
│  └──────────────────────────────────────────────┘      │   │
│                                                         │   │
└─────────────────────────────────────────────────────────┼───┘
                                                          │
                    ┌─────────────────────────────────────┘
                    │
                    │ (EventEmitter)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│               TUI Event Subscription                        │
│                                                             │
│  toolClientRef.current.on('tool_event', (event) => {       │
│    switch(event.type) {                                    │
│      case 'tool_call_start':                               │
│        - Add to activeToolCalls Map                        │
│        - Show in ToolExecutionPanel                        │
│        - Display with ⏳ icon                              │
│      case 'tool_call_complete':                            │
│        - Remove from activeToolCalls                       │
│        - Add to completedToolCalls                         │
│        - Display with ✅ icon                              │
│        - Update duration                                   │
│      case 'tool_call_error':                               │
│        - Remove from activeToolCalls                       │
│        - Add to completedToolCalls                         │
│        - Display with ❌ icon                              │
│        - Show error message                                │
│    }                                                       │
│  })                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              TUI Rendering                                  │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │  ToolExecutionPanel                 │                   │
│  │  ┌───────────────────────────────┐  │                   │
│  │  │ Active: ⏳ readFile (123ms)   │  │                   │
│  │  │   params: {path: "..."}       │  │                   │
│  │  └───────────────────────────────┘  │                   │
│  │                                     │                   │
│  │  Recent:                            │                   │
│  │  ┌───────────────────────────────┐  │                   │
│  │  │ ✅ searchFiles (45ms) ▶       │  │                   │
│  │  │ ✅ blobSearch (234ms) ▶       │  │                   │
│  │  │ ❌ bashExec (12ms) ▶          │  │                   │
│  │  └───────────────────────────────┘  │                   │
│  └─────────────────────────────────────┘                   │
│                                                             │
│  [After response completes]                                │
│                                                             │
│  ┌─────────────────────────────────────┐                   │
│  │  ToolSummary                        │                   │
│  │  Total: 15 calls | 93% success     │                   │
│  │  Avg: 156ms | Total: 2.3s          │                   │
│  │                                     │                   │
│  │  Tools Used:                        │                   │
│  │  • readFile: 5× (5✓) ~120ms        │                   │
│  │  • searchFiles: 3× (3✓) ~234ms     │                   │
│  │  • bashExec: 2× (1✓, 1✗) ~89ms     │                   │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```
src/
├── lib/
│   ├── streaming/
│   │   ├── types/
│   │   │   └── ToolEvents.ts          (NEW) Event type definitions
│   │   ├── StreamingClientWithTools.ts (MODIFY) Add EventEmitter
│   │   └── ToolCategories.ts          (NEW) Color/icon mappings
│   │
│   └── history/
│       └── ToolHistoryManager.ts      (NEW) Persistent storage
│
└── tui/
    ├── components/
    │   ├── ToolCallDisplay.tsx        (NEW) Single tool call UI
    │   ├── ToolExecutionPanel.tsx     (NEW) Active/recent tools panel
    │   └── ToolSummary.tsx            (NEW) Post-response summary
    │
    └── multiagent-tui.tsx             (MODIFY) Integrate components
```

---

## Implementation Checklist

### Phase 1: Foundation (Day 1-2)
- [ ] Create `ToolEvents.ts` with event type definitions
- [ ] Create `ToolCategories.ts` with color/icon scheme
- [ ] Modify `StreamingClientWithTools.ts`:
  - [ ] Add EventEmitter inheritance
  - [ ] Add call ID generation (uuid)
  - [ ] Add timing tracking in `executeTool()`
  - [ ] Emit events at each stage
  - [ ] Add `toolCallHistory` array
  - [ ] Implement `getToolHistory()`
  - [ ] Implement `getToolSummary()`
  - [ ] Implement `clearToolHistory()`

### Phase 2: UI Components (Day 2-3)
- [ ] Create `ToolCallDisplay.tsx`:
  - [ ] Collapsible header
  - [ ] Color coding by tool type
  - [ ] Parameter formatting
  - [ ] Result/error display
  - [ ] Duration display
- [ ] Create `ToolExecutionPanel.tsx`:
  - [ ] Active tools section
  - [ ] Recent tools section
  - [ ] Toggle visibility
- [ ] Create `ToolSummary.tsx`:
  - [ ] Overall statistics
  - [ ] Per-tool breakdown
  - [ ] Success rate visualization

### Phase 3: TUI Integration (Day 3-4)
- [ ] Modify `AppState` interface:
  - [ ] Add `activeToolCalls: Map<string, ToolCallRecord>`
  - [ ] Add `completedToolCalls: ToolCallRecord[]`
  - [ ] Add `currentToolSummary`
  - [ ] Add `showToolPanel` flag
- [ ] Add event subscription in `useEffect`:
  - [ ] Subscribe to 'tool_event'
  - [ ] Handle `tool_call_start`
  - [ ] Handle `tool_call_complete`
  - [ ] Handle `tool_call_error`
- [ ] Add components to render tree:
  - [ ] `<ToolExecutionPanel />` before input
  - [ ] `<ToolSummary />` after response
- [ ] Add summary generation after streaming completes
- [ ] Add auto-hide timer for summary

### Phase 4: History & Commands (Day 4-5)
- [ ] Create `ToolHistoryManager.ts`:
  - [ ] Implement `initialize()`
  - [ ] Implement `saveToolCall()`
  - [ ] Implement `getToolHistory()`
  - [ ] Implement `getAllHistory()`
  - [ ] Implement `getToolStats()`
- [ ] Add `/tools-history` command:
  - [ ] Show overall history
  - [ ] Show per-tool history
  - [ ] Show statistics
- [ ] Add `/tools-panel` toggle command
- [ ] Initialize `ToolHistoryManager` in TUI
- [ ] Save tool calls to history on completion

### Phase 5: Testing & Polish (Day 5-6)
- [ ] Test with all standard tools
- [ ] Test with MCP tools
- [ ] Test error scenarios
- [ ] Test collapsible UI interactions
- [ ] Verify color coding
- [ ] Test history persistence
- [ ] Performance testing with many tool calls
- [ ] Documentation updates

---

## Technical Considerations

### Performance
- **EventEmitter overhead**: Minimal, events are async and non-blocking
- **State updates**: Use functional setState to avoid race conditions
- **History storage**: Keep in-memory limit (1000 records) to prevent memory bloat
- **UI rendering**: Limit recent tools to 5-10 to avoid scroll spam

### Edge Cases
1. **Rapid tool calls**: Queue updates properly with Map for active calls
2. **Long-running tools**: Show duration updating in real-time
3. **Tool call failures**: Gracefully display error messages
4. **Concurrent tool execution**: Support multiple active tools
5. **Large result objects**: Truncate display (first 200 chars)
6. **Tool history overflow**: Rotate old records (keep last 1000)

### Error Handling
- **Event emission failures**: Wrap in try-catch, log but don't crash
- **History save failures**: Log warning, continue execution
- **UUID generation**: Use `uuid` package for guaranteed uniqueness
- **State update failures**: Catch errors in setState callbacks

### Dependencies
**New packages needed:**
```json
{
  "uuid": "^9.0.0",
  "@types/uuid": "^9.0.0"
}
```

---

## Future Enhancements

1. **Tool Performance Analytics**
   - Track tool performance over time
   - Identify slow tools
   - Trend analysis

2. **Tool Call Replay**
   - Re-execute past tool calls
   - Debug tool failures

3. **Tool Call Filters**
   - Filter by tool type
   - Filter by success/failure
   - Search tool history

4. **Export Tool History**
   - Export to CSV/JSON
   - Share with team

5. **Tool Call Visualization**
   - Timeline view
   - Dependency graph
   - Performance charts

6. **Real-time Notifications**
   - Alert on tool failures
   - Warn on slow tools
   - Desktop notifications

---

## Success Criteria

✅ **Functional Requirements:**
- [ ] All tool calls visible in real-time
- [ ] Parameters, duration, and results displayed
- [ ] Success/failure clearly indicated
- [ ] Collapsible UI to reduce clutter
- [ ] Summary generated after each response
- [ ] History accessible via `/tools-history`
- [ ] Color-coded by tool category

✅ **Performance Requirements:**
- [ ] Event emission < 1ms overhead per tool call
- [ ] UI updates don't block streaming
- [ ] History storage < 10MB for 1000 records
- [ ] Panel collapse/expand < 100ms

✅ **User Experience:**
- [ ] Clear visual hierarchy
- [ ] Easy to scan active vs completed tools
- [ ] Error messages actionable
- [ ] Summary auto-hides after 10s
- [ ] Commands intuitive and documented

---

## Timeline Estimate

- **Phase 1 (Foundation)**: 1-2 days
- **Phase 2 (UI Components)**: 1-2 days
- **Phase 3 (Integration)**: 1-2 days
- **Phase 4 (History)**: 1 day
- **Phase 5 (Testing)**: 1 day

**Total**: 5-7 days for full implementation

---

## References

- Current tool logging: `src/lib/streaming/StreamingClientWithTools.ts:795-797`
- TUI component patterns: `src/tui/multiagent-tui.tsx`
- Agent status display: `src/tui/multiagent-tui.tsx:143-195` (AgentStatusBox)
- Event system: Node.js EventEmitter

---

**End of Implementation Plan**
