# Phase 4 TUI Integration Guide

This guide shows how to integrate all Phase 4 features into the TUI (src/tui/multiagent-tui.tsx).

## ✅ Completed Phase 4 Features

1. ✅ **4.1 Pattern Recognition** - Detect recurring patterns in code and behavior
2. ✅ **4.2 Graph Query Language** - SQL-like queries for knowledge graph
3. ✅ **4.3 Layout Customization** - Customizable panel layouts
4. ✅ **4.4 Progress Estimation** - Task time and complexity estimation
5. ✅ **4.5 Template Collections** - Curated template groups
6. ✅ **4.6 File Reference System** - @file syntax for context
7. ✅ **4.7 Screenshot Integration** - Capture and share TUI screenshots
8. ✅ **4.8 Permission Templates** - Pre-configured permission sets
9. ✅ **4.9 Permission Revocation UI** - Manage granted permissions
10. ✅ **Systematic Thinking** - Claude Code-style thinking blocks

## 📦 Required Imports

Add these imports to `src/tui/multiagent-tui.tsx`:

```typescript
// Phase 4 - New Features
import { getPatternRecognition, PatternRecognition, DetectedPattern } from '../lib/patterns';
import { getLayoutManager, LayoutManager, PanelConfig } from '../lib/layout';
import { getProgressEstimator, ProgressEstimator, TaskEstimate, TaskProgress } from '../lib/progress';
import { getTemplateCollections, TemplateCollections, TemplateCollection } from '../lib/templates/TemplateCollections';
import { getFileReferenceParser, FileReferenceParser, ResolvedReference } from '../lib/file-reference';
import { getScreenshotManager, ScreenshotManager } from '../lib/screenshot';
import { getPermissionTemplates, PermissionTemplates, PermissionTemplate } from '../lib/permissions/PermissionTemplates';
import { getSystematicThinking, SystematicThinking, StructuredResponse } from '../lib/agents/SystematicThinking';

// Phase 4 - UI Components
import { PatternRecognitionPanel } from './components/PatternRecognitionPanel';
import { GraphQueryPanel } from './components/GraphQueryPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { TemplateCollectionsPanel } from './components/TemplateCollectionsPanel';
import { ThinkingPanel } from './components/ThinkingPanel';
import { PermissionRevocationPanel } from './components/PermissionRevocationPanel';
```

## 🔧 AppState Updates

Extend the `AppState` interface:

```typescript
interface AppState {
  // ... existing state

  // Phase 4 - Pattern Recognition
  showPatterns: boolean;
  patterns: DetectedPattern[];

  // Phase 4 - Layout Customization
  layoutPreset: string;
  customLayout: Map<string, PanelConfig>;

  // Phase 4 - Progress Estimation
  showProgress: boolean;
  currentEstimate?: TaskEstimate;
  currentProgress?: TaskProgress;

  // Phase 4 - Template Collections
  showTemplateCollections: boolean;
  selectedCollection?: TemplateCollection;

  // Phase 4 - File References
  fileReferences: ResolvedReference[];

  // Phase 4 - Screenshot
  screenshotMode: boolean;

  // Phase 4 - Permission Management
  showPermissions: boolean;
  grantedPermissions: any[]; // Will be defined by permission system

  // Phase 4 - Systematic Thinking
  showThinking: boolean;
  structuredResponse?: StructuredResponse;
}
```

## 🎯 System Initialization

Add to useEffect initialization:

```typescript
useEffect(() => {
  const init = async () => {
    // ... existing initialization

    // Phase 4 - Initialize systems
    const patternRecognition = getPatternRecognition();
    const layoutManager = getLayoutManager();
    const progressEstimator = getProgressEstimator();
    const templateCollections = getTemplateCollections();
    const fileReferenceParser = getFileReferenceParser();
    const screenshotManager = getScreenshotManager();
    const permissionTemplates = getPermissionTemplates();
    const systematicThinking = getSystematicThinking();

    await Promise.all([
      patternRecognition.initialize(),
      layoutManager.initialize(),
      progressEstimator.initialize(),
      templateCollections.initialize(),
      screenshotManager.initialize(),
      permissionTemplates.initialize(),
    ]);

    // Store refs
    patternRecognitionRef.current = patternRecognition;
    layoutManagerRef.current = layoutManager;
    progressEstimatorRef.current = progressEstimator;
    templateCollectionsRef.current = templateCollections;
    fileReferenceParserRef.current = fileReferenceParser;
    screenshotManagerRef.current = screenshotManager;
    permissionTemplatesRef.current = permissionTemplates;
    systematicThinkingRef.current = systematicThinking;

    // Set up event listeners
    patternRecognition.on('pattern:detected', (pattern) => {
      setState(prev => ({
        ...prev,
        patterns: [...prev.patterns, pattern],
      }));
    });

    progressEstimator.on('task:progress', (progress) => {
      setState(prev => ({
        ...prev,
        currentProgress: progress,
      }));
    });
  };

  init();
}, []);
```

## ⌨️ Keyboard Shortcuts

Add to keyboard input handler:

```typescript
const handleInput = (_input: string, key: any) => {
  // ... existing shortcuts

  // Phase 4 Shortcuts
  if (key.ctrl && key.shift && input === 'p') {
    // Ctrl+Shift+P - Pattern Recognition
    setState(prev => ({ ...prev, showPatterns: !prev.showPatterns }));
    return;
  }

  if (key.ctrl && key.shift && input === 'q') {
    // Ctrl+Shift+Q - Graph Query
    setState(prev => ({ ...prev, showGraphQuery: !prev.showGraphQuery }));
    return;
  }

  if (key.ctrl && key.shift && input === 'l') {
    // Ctrl+Shift+L - Layout Customization
    setState(prev => ({ ...prev, showLayoutSettings: !prev.showLayoutSettings }));
    return;
  }

  if (key.ctrl && input === 'e') {
    // Ctrl+E - Progress Estimation
    setState(prev => ({ ...prev, showProgress: !prev.showProgress }));
    return;
  }

  if (key.ctrl && key.shift && input === 'c') {
    // Ctrl+Shift+C - Template Collections
    setState(prev => ({ ...prev, showTemplateCollections: !prev.showTemplateCollections }));
    return;
  }

  if (key.ctrl && key.shift && input === 's') {
    // Ctrl+Shift+S - Screenshot
    const screenshotManager = screenshotManagerRef.current;
    if (screenshotManager) {
      screenshotManager.captureScreenshot({ format: 'png', copyToClipboard: true });
    }
    return;
  }

  if (key.ctrl && key.shift && input === 'r') {
    // Ctrl+Shift+R - Permission Revocation
    setState(prev => ({ ...prev, showPermissions: !prev.showPermissions }));
    return;
  }

  if (key.ctrl && key.shift && input === 'k') {
    // Ctrl+Shift+K - Systematic Thinking Panel
    setState(prev => ({ ...prev, showThinking: !prev.showThinking }));
    return;
  }
};
```

## 🎨 Render Panels

Add panels to the render function:

```typescript
return (
  <Box flexDirection="column">
    {/* ... existing panels */}

    {/* Phase 4 - Pattern Recognition */}
    {state.showPatterns && (
      <PatternRecognitionPanel
        patterns={state.patterns}
        onClose={() => setState(prev => ({ ...prev, showPatterns: false }))}
      />
    )}

    {/* Phase 4 - Graph Query */}
    {state.showGraphQuery && (
      <GraphQueryPanel
        onExecuteQuery={async (query) => {
          const gql = new GraphQueryLanguage(knowledgeGraphRef.current!);
          return await gql.execute(query);
        }}
        queryHistory={state.graphQueryHistory || []}
        onClose={() => setState(prev => ({ ...prev, showGraphQuery: false }))}
      />
    )}

    {/* Phase 4 - Progress Estimation */}
    {state.showProgress && (
      <ProgressPanel
        currentProgress={state.currentProgress}
        currentEstimate={state.currentEstimate}
        onClose={() => setState(prev => ({ ...prev, showProgress: false }))}
      />
    )}

    {/* Phase 4 - Template Collections */}
    {state.showTemplateCollections && (
      <TemplateCollectionsPanel
        collections={templateCollectionsRef.current?.getAllCollections() || []}
        selectedCollection={state.selectedCollection}
        onSelectCollection={(id) => {
          const collection = templateCollectionsRef.current?.getCollection(id);
          setState(prev => ({ ...prev, selectedCollection: collection }));
        }}
        onClose={() => setState(prev => ({ ...prev, showTemplateCollections: false }))}
      />
    )}

    {/* Phase 4 - Systematic Thinking */}
    {state.showThinking && state.structuredResponse && (
      <ThinkingPanel
        structuredResponse={state.structuredResponse}
        onClose={() => setState(prev => ({ ...prev, showThinking: false }))}
      />
    )}

    {/* Phase 4 - Permission Management */}
    {state.showPermissions && (
      <PermissionRevocationPanel
        grantedPermissions={state.grantedPermissions}
        templates={permissionTemplatesRef.current?.getAllTemplates() || []}
        onClose={() => setState(prev => ({ ...prev, showPermissions: false }))}
      />
    )}
  </Box>
);
```

## 📝 Update /help Command

Add Phase 4 shortcuts to the help command:

```typescript
const helpText = `
Available Commands:
// ... existing commands

Phase 4 Features:
  Ctrl+Shift+P        Toggle Pattern Recognition Panel
  Ctrl+Shift+Q        Toggle Graph Query Panel
  Ctrl+Shift+L        Toggle Layout Customization
  Ctrl+E              Toggle Progress Estimation Panel
  Ctrl+Shift+C        Toggle Template Collections
  Ctrl+Shift+S        Capture Screenshot
  Ctrl+Shift+R        Toggle Permission Management
  Ctrl+Shift+K        Toggle Systematic Thinking Panel
`;
```

## 🔄 Message Processing with Systematic Thinking

Update message processing to parse thinking blocks:

```typescript
const processAgentMessage = (message: string) => {
  const systematicThinking = systematicThinkingRef.current;
  if (!systematicThinking) return;

  // Check if message contains thinking blocks
  if (systematicThinking.hasThinkingBlocks(message)) {
    const structured = systematicThinking.parseStructuredResponse(message);

    // Store structured response for display
    setState(prev => ({
      ...prev,
      structuredResponse: structured,
      showThinking: true, // Auto-show thinking panel
    }));

    // Extract final response for regular display
    const finalResponse = systematicThinking.extractFinalResponse(message);
    return finalResponse;
  }

  return message;
};
```

## 🎯 File Reference Processing

Add file reference processing to message input:

```typescript
const handleSubmit = async () => {
  const fileRefParser = fileReferenceParserRef.current;
  if (!fileRefParser) return;

  const userMessage = state.currentInput;

  // Parse and resolve file references
  const references = fileRefParser.parseReferences(userMessage);
  if (references.length > 0) {
    const resolved = await fileRefParser.resolveReferences(references);

    // Add resolved file content to context
    setState(prev => ({
      ...prev,
      fileReferences: resolved,
    }));

    // Build enhanced message with file content
    const enhancedMessage = buildMessageWithFileRefs(userMessage, resolved);
    // Send enhanced message to agent...
  }
};
```

## 🎨 Layout Customization

Add layout preset switching:

```typescript
const applyLayoutPreset = (presetId: string) => {
  const layoutManager = layoutManagerRef.current;
  if (!layoutManager) return;

  layoutManager.loadPreset(presetId);
  setState(prev => ({
    ...prev,
    layoutPreset: presetId,
  }));
};
```

## 📊 Pattern Observation

Add pattern observation hooks:

```typescript
// Observe file access patterns
const observeFileAccess = (filePath: string, operation: 'read' | 'write' | 'delete') => {
  patternRecognitionRef.current?.observeFileAccess(filePath, operation, context);
};

// Observe tool usage patterns
const observeToolUsage = (toolName: string, args: any, result: any) => {
  patternRecognitionRef.current?.observeToolUsage(toolName, args, result, context);
};

// Observe conversation patterns
const observeConversation = (userMessage: string, agentResponse: string) => {
  patternRecognitionRef.current?.observeConversation(userMessage, agentResponse, context);
};
```

## 🚀 Quick Implementation Checklist

- [ ] Add Phase 4 imports
- [ ] Extend AppState interface
- [ ] Initialize Phase 4 systems in useEffect
- [ ] Add keyboard shortcuts
- [ ] Render Phase 4 panels
- [ ] Update /help command
- [ ] Add systematic thinking message processing
- [ ] Add file reference processing
- [ ] Add pattern observation hooks
- [ ] Test all Phase 4 features
- [ ] Update ShortcutsPanel with new shortcuts

## 🔧 Testing Phase 4 Features

1. **Pattern Recognition**: Use the app, then press Ctrl+Shift+P to see detected patterns
2. **Graph Query**: Press Ctrl+Shift+Q and try: `MATCH (n:File) RETURN n`
3. **Layout**: Press Ctrl+Shift+L to customize panel layout
4. **Progress**: Press Ctrl+E to see task progress estimation
5. **Collections**: Press Ctrl+Shift+C to browse template collections
6. **File Refs**: Type `@README.md` in a message to reference files
7. **Screenshot**: Press Ctrl+Shift+S to capture a screenshot
8. **Permissions**: Press Ctrl+Shift+R to manage permissions
9. **Thinking**: Send a message and press Ctrl+Shift+K to see agent's thinking process

## 📚 Additional Resources

- See individual feature files in `src/lib/` for detailed API documentation
- See component files in `src/tui/components/` for UI customization
- Check `src/lib/agents/SystematicAgentPrompts.ts` for systematic thinking format

---

**Status**: All Phase 4 features implemented ✅
**Next Steps**: Integrate into TUI, test thoroughly, and begin Phase 5 planning
