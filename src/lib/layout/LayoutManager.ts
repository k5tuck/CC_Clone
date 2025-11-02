/**
 * Layout Manager
 * Manages TUI layout customization and panel arrangements
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Panel position
 */
export enum PanelPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
  CENTER = 'center',
  FLOATING = 'floating',
}

/**
 * Panel size mode
 */
export enum PanelSizeMode {
  FIXED = 'fixed',
  FLEXIBLE = 'flexible',
  AUTO = 'auto',
}

/**
 * Panel configuration
 */
export interface PanelConfig {
  id: string;
  name: string;
  position: PanelPosition;
  sizeMode: PanelSizeMode;
  width?: number;  // For FIXED mode
  height?: number; // For FIXED mode
  flexGrow?: number; // For FLEXIBLE mode
  visible: boolean;
  zIndex: number;
  collapsible: boolean;
  collapsed: boolean;
  resizable: boolean;
}

/**
 * Layout preset
 */
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  panels: Map<string, PanelConfig>;
  createdAt: Date;
  custom: boolean;
}

/**
 * Layout zone
 */
export interface LayoutZone {
  position: PanelPosition;
  panels: PanelConfig[];
  width?: number;
  height?: number;
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  currentPreset: string;
  presets: Map<string, LayoutPreset>;
  panelRegistry: Map<string, PanelConfig>;
  zones: LayoutZone[];
}

/**
 * Layout Manager
 */
export class LayoutManager extends EventEmitter {
  private config: LayoutConfig;
  private configFile: string;
  private defaultPanels: Map<string, Omit<PanelConfig, 'id' | 'name'>> = new Map();

  constructor(customConfigFile?: string) {
    super();
    this.configFile = customConfigFile || path.join(os.homedir(), '.selek', 'layout.json');

    this.config = {
      currentPreset: 'default',
      presets: new Map(),
      panelRegistry: new Map(),
      zones: [],
    };

    this.initializeDefaultPanels();
  }

  /**
   * Initialize default panel configurations
   */
  private initializeDefaultPanels(): void {
    // Register all available panels with default configs
    const defaults: Array<[string, Omit<PanelConfig, 'id' | 'name'>]> = [
      ['messages', {
        position: PanelPosition.CENTER,
        sizeMode: PanelSizeMode.FLEXIBLE,
        flexGrow: 1,
        visible: true,
        zIndex: 1,
        collapsible: false,
        collapsed: false,
        resizable: false,
      }],
      ['input', {
        position: PanelPosition.BOTTOM,
        sizeMode: PanelSizeMode.AUTO,
        visible: true,
        zIndex: 100,
        collapsible: false,
        collapsed: false,
        resizable: false,
      }],
      ['search', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['tools', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['knowledge-graph', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 60,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['context', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['errors', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['agents', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['templates', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 50,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['progress', {
        position: PanelPosition.TOP,
        sizeMode: PanelSizeMode.AUTO,
        visible: false,
        zIndex: 5,
        collapsible: true,
        collapsed: false,
        resizable: false,
      }],
      ['patterns', {
        position: PanelPosition.RIGHT,
        sizeMode: PanelSizeMode.FIXED,
        width: 60,
        visible: false,
        zIndex: 10,
        collapsible: true,
        collapsed: false,
        resizable: true,
      }],
      ['shortcuts', {
        position: PanelPosition.FLOATING,
        sizeMode: PanelSizeMode.AUTO,
        visible: false,
        zIndex: 999,
        collapsible: false,
        collapsed: false,
        resizable: false,
      }],
    ];

    for (const [id, config] of defaults) {
      this.defaultPanels.set(id, config);
    }
  }

  /**
   * Initialize layout manager
   */
  async initialize(): Promise<void> {
    await this.loadConfig();
    this.createDefaultPresets();
    this.emit('initialized');
  }

  /**
   * Register a panel
   */
  registerPanel(id: string, name: string, config?: Partial<PanelConfig>): void {
    const defaultConfig = this.defaultPanels.get(id) || {
      position: PanelPosition.RIGHT,
      sizeMode: PanelSizeMode.FIXED,
      width: 50,
      visible: false,
      zIndex: 10,
      collapsible: true,
      collapsed: false,
      resizable: true,
    };

    const panelConfig: PanelConfig = {
      id,
      name,
      ...defaultConfig,
      ...config,
    };

    this.config.panelRegistry.set(id, panelConfig);
    this.emit('panel:registered', panelConfig);
  }

  /**
   * Get panel configuration
   */
  getPanelConfig(id: string): PanelConfig | undefined {
    return this.config.panelRegistry.get(id);
  }

  /**
   * Update panel configuration
   */
  updatePanelConfig(id: string, updates: Partial<PanelConfig>): void {
    const panel = this.config.panelRegistry.get(id);
    if (!panel) return;

    const updated = { ...panel, ...updates };
    this.config.panelRegistry.set(id, updated);

    this.emit('panel:updated', updated);
    this.saveConfig();
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(id: string): boolean {
    const panel = this.config.panelRegistry.get(id);
    if (!panel) return false;

    panel.visible = !panel.visible;
    this.emit('panel:toggled', { id, visible: panel.visible });
    this.saveConfig();

    return panel.visible;
  }

  /**
   * Collapse/expand panel
   */
  toggleCollapse(id: string): boolean {
    const panel = this.config.panelRegistry.get(id);
    if (!panel || !panel.collapsible) return false;

    panel.collapsed = !panel.collapsed;
    this.emit('panel:collapsed', { id, collapsed: panel.collapsed });
    this.saveConfig();

    return panel.collapsed;
  }

  /**
   * Resize panel
   */
  resizePanel(id: string, width?: number, height?: number): void {
    const panel = this.config.panelRegistry.get(id);
    if (!panel || !panel.resizable) return;

    if (width !== undefined) panel.width = Math.max(20, Math.min(width, 200));
    if (height !== undefined) panel.height = Math.max(5, Math.min(height, 100));

    this.emit('panel:resized', { id, width: panel.width, height: panel.height });
    this.saveConfig();
  }

  /**
   * Move panel to new position
   */
  movePanel(id: string, position: PanelPosition): void {
    const panel = this.config.panelRegistry.get(id);
    if (!panel) return;

    panel.position = position;
    this.emit('panel:moved', { id, position });
    this.saveConfig();
  }

  /**
   * Get panels by position
   */
  getPanelsByPosition(position: PanelPosition): PanelConfig[] {
    return Array.from(this.config.panelRegistry.values())
      .filter(p => p.position === position)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Get all visible panels
   */
  getVisiblePanels(): PanelConfig[] {
    return Array.from(this.config.panelRegistry.values())
      .filter(p => p.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Create a layout preset
   */
  createPreset(name: string, description: string): string {
    const id = `preset_${Date.now()}`;
    const preset: LayoutPreset = {
      id,
      name,
      description,
      panels: new Map(this.config.panelRegistry),
      createdAt: new Date(),
      custom: true,
    };

    this.config.presets.set(id, preset);
    this.emit('preset:created', preset);
    this.saveConfig();

    return id;
  }

  /**
   * Load a preset
   */
  loadPreset(id: string): boolean {
    const preset = this.config.presets.get(id);
    if (!preset) return false;

    this.config.panelRegistry = new Map(preset.panels);
    this.config.currentPreset = id;

    this.emit('preset:loaded', preset);
    this.saveConfig();

    return true;
  }

  /**
   * Delete a preset
   */
  deletePreset(id: string): boolean {
    const preset = this.config.presets.get(id);
    if (!preset || !preset.custom) return false;

    this.config.presets.delete(id);
    if (this.config.currentPreset === id) {
      this.config.currentPreset = 'default';
      this.loadPreset('default');
    }

    this.emit('preset:deleted', id);
    this.saveConfig();

    return true;
  }

  /**
   * Get all presets
   */
  getPresets(): LayoutPreset[] {
    return Array.from(this.config.presets.values());
  }

  /**
   * Get current preset
   */
  getCurrentPreset(): LayoutPreset | undefined {
    return this.config.presets.get(this.config.currentPreset);
  }

  /**
   * Create default presets
   */
  private createDefaultPresets(): void {
    if (this.config.presets.size > 0) return;

    // Default preset - balanced layout
    const defaultPreset: LayoutPreset = {
      id: 'default',
      name: 'Default',
      description: 'Balanced layout with all features accessible',
      panels: new Map(this.config.panelRegistry),
      createdAt: new Date(),
      custom: false,
    };
    this.config.presets.set('default', defaultPreset);

    // Minimal preset - just messages and input
    const minimalPanels = new Map(this.config.panelRegistry);
    for (const [id, panel] of minimalPanels) {
      if (id !== 'messages' && id !== 'input') {
        panel.visible = false;
      }
    }
    const minimalPreset: LayoutPreset = {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean layout with only conversation',
      panels: minimalPanels,
      createdAt: new Date(),
      custom: false,
    };
    this.config.presets.set('minimal', minimalPreset);

    // Developer preset - with knowledge graph, context, tools
    const devPanels = new Map(this.config.panelRegistry);
    for (const [id, panel] of devPanels) {
      if (['knowledge-graph', 'context', 'tools', 'patterns'].includes(id)) {
        panel.visible = true;
      }
    }
    const devPreset: LayoutPreset = {
      id: 'developer',
      name: 'Developer',
      description: 'Full development environment with all tools',
      panels: devPanels,
      createdAt: new Date(),
      custom: false,
    };
    this.config.presets.set('developer', devPreset);
  }

  /**
   * Reset to default layout
   */
  resetToDefault(): void {
    this.loadPreset('default');
  }

  /**
   * Get layout statistics
   */
  getStatistics() {
    const visible = this.getVisiblePanels().length;
    const total = this.config.panelRegistry.size;

    return {
      totalPanels: total,
      visiblePanels: visible,
      hiddenPanels: total - visible,
      currentPreset: this.config.currentPreset,
      totalPresets: this.config.presets.size,
      customPresets: Array.from(this.config.presets.values()).filter(p => p.custom).length,
    };
  }

  /**
   * Load configuration from disk
   */
  private async loadConfig(): Promise<void> {
    try {
      const dir = path.dirname(this.configFile);
      await fs.mkdir(dir, { recursive: true });

      const content = await fs.readFile(this.configFile, 'utf-8');
      const data = JSON.parse(content);

      this.config.currentPreset = data.currentPreset || 'default';

      // Load panel registry
      if (data.panelRegistry) {
        this.config.panelRegistry = new Map(Object.entries(data.panelRegistry));
      }

      // Load presets
      if (data.presets) {
        this.config.presets = new Map();
        for (const [id, presetData] of Object.entries(data.presets)) {
          const preset = presetData as any;
          this.config.presets.set(id, {
            ...preset,
            panels: new Map(Object.entries(preset.panels || {})),
            createdAt: new Date(preset.createdAt),
          });
        }
      }
    } catch {
      // File doesn't exist, use defaults
    }
  }

  /**
   * Save configuration to disk
   */
  async saveConfig(): Promise<void> {
    const dir = path.dirname(this.configFile);
    await fs.mkdir(dir, { recursive: true });

    const data = {
      currentPreset: this.config.currentPreset,
      panelRegistry: Object.fromEntries(this.config.panelRegistry),
      presets: Object.fromEntries(
        Array.from(this.config.presets.entries()).map(([id, preset]) => [
          id,
          {
            ...preset,
            panels: Object.fromEntries(preset.panels),
          },
        ])
      ),
    };

    await fs.writeFile(this.configFile, JSON.stringify(data, null, 2));
  }
}

// Singleton instance
let layoutManagerInstance: LayoutManager | null = null;

/**
 * Get the global layout manager
 */
export function getLayoutManager(): LayoutManager {
  if (!layoutManagerInstance) {
    layoutManagerInstance = new LayoutManager();
  }
  return layoutManagerInstance;
}
