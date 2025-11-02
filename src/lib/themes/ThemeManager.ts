/**
 * Theme Manager
 * Manages TUI color schemes and appearance
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Color palette
 */
export interface ColorPalette {
  // Primary colors
  primary: string;
  secondary: string;
  accent: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI colors
  background: string;
  foreground: string;
  border: string;
  dim: string;
  highlight: string;

  // Semantic colors
  agent: string;
  user: string;
  system: string;
  code: string;
  comment: string;
}

/**
 * Theme
 */
export interface Theme {
  id: string;
  name: string;
  description: string;
  author?: string;
  dark: boolean;
  colors: ColorPalette;
  createdAt: Date;
  favorite: boolean;
}

/**
 * Theme Manager
 */
export class ThemeManager extends EventEmitter {
  private themes: Map<string, Theme> = new Map();
  private currentThemeId: string = 'default-dark';
  private themesDir: string;

  constructor(customDir?: string) {
    super();
    this.themesDir = customDir || path.join(os.homedir(), '.selek', 'themes');
  }

  /**
   * Initialize the theme manager
   */
  async initialize(): Promise<void> {
    // Ensure themes directory exists
    await fs.mkdir(this.themesDir, { recursive: true });

    // Load themes from disk
    await this.loadThemes();

    // Create default themes if none exist
    if (this.themes.size === 0) {
      await this.createDefaultThemes();
    }

    this.emit('initialized');
  }

  /**
   * Load themes from disk
   */
  private async loadThemes(): Promise<void> {
    try {
      const files = await fs.readdir(this.themesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.themesDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const theme = JSON.parse(content) as Theme;
            theme.createdAt = new Date(theme.createdAt);
            this.themes.set(theme.id, theme);
          } catch (error) {
            console.error(`Error loading theme ${file}:`, error);
          }
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  /**
   * Create default themes
   */
  private async createDefaultThemes(): Promise<void> {
    const defaults: Omit<Theme, 'createdAt' | 'favorite'>[] = [
      {
        id: 'default-dark',
        name: 'Default Dark',
        description: 'Classic dark theme with blue accents',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'blue',
          secondary: 'cyan',
          accent: 'magenta',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'black',
          foreground: 'white',
          border: 'gray',
          dim: 'gray',
          highlight: 'cyan',
          agent: 'cyan',
          user: 'blue',
          system: 'yellow',
          code: 'green',
          comment: 'gray',
        },
      },
      {
        id: 'default-light',
        name: 'Default Light',
        description: 'Clean light theme',
        author: 'Selek',
        dark: false,
        colors: {
          primary: 'blue',
          secondary: 'cyan',
          accent: 'magenta',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'white',
          foreground: 'black',
          border: 'gray',
          dim: 'gray',
          highlight: 'blue',
          agent: 'blue',
          user: 'cyan',
          system: 'yellow',
          code: 'green',
          comment: 'gray',
        },
      },
      {
        id: 'oceanic',
        name: 'Oceanic',
        description: 'Deep blue ocean-inspired theme',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'cyan',
          secondary: 'blue',
          accent: 'green',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'black',
          foreground: 'cyan',
          border: 'blue',
          dim: 'blue',
          highlight: 'green',
          agent: 'cyan',
          user: 'blue',
          system: 'green',
          code: 'cyan',
          comment: 'blue',
        },
      },
      {
        id: 'forest',
        name: 'Forest',
        description: 'Nature-inspired green theme',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'green',
          secondary: 'yellow',
          accent: 'cyan',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'black',
          foreground: 'green',
          border: 'green',
          dim: 'gray',
          highlight: 'yellow',
          agent: 'green',
          user: 'yellow',
          system: 'cyan',
          code: 'green',
          comment: 'gray',
        },
      },
      {
        id: 'sunset',
        name: 'Sunset',
        description: 'Warm sunset colors',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'yellow',
          secondary: 'red',
          accent: 'magenta',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'black',
          foreground: 'yellow',
          border: 'red',
          dim: 'gray',
          highlight: 'magenta',
          agent: 'yellow',
          user: 'red',
          system: 'magenta',
          code: 'yellow',
          comment: 'red',
        },
      },
      {
        id: 'monochrome',
        name: 'Monochrome',
        description: 'Pure black and white',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'white',
          secondary: 'gray',
          accent: 'white',
          success: 'white',
          warning: 'white',
          error: 'white',
          info: 'gray',
          background: 'black',
          foreground: 'white',
          border: 'white',
          dim: 'gray',
          highlight: 'white',
          agent: 'white',
          user: 'gray',
          system: 'white',
          code: 'gray',
          comment: 'gray',
        },
      },
      {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'Neon-inspired futuristic theme',
        author: 'Selek',
        dark: true,
        colors: {
          primary: 'magenta',
          secondary: 'cyan',
          accent: 'yellow',
          success: 'green',
          warning: 'yellow',
          error: 'red',
          info: 'cyan',
          background: 'black',
          foreground: 'magenta',
          border: 'cyan',
          dim: 'magenta',
          highlight: 'yellow',
          agent: 'magenta',
          user: 'cyan',
          system: 'yellow',
          code: 'cyan',
          comment: 'magenta',
        },
      },
    ];

    for (const themeData of defaults) {
      await this.createTheme(themeData);
    }
  }

  /**
   * Create a new theme
   */
  async createTheme(data: Omit<Theme, 'createdAt' | 'favorite'>): Promise<Theme> {
    const theme: Theme = {
      ...data,
      createdAt: new Date(),
      favorite: false,
    };

    this.themes.set(theme.id, theme);
    await this.saveTheme(theme);

    this.emit('theme:created', theme);
    return theme;
  }

  /**
   * Update a theme
   */
  async updateTheme(id: string, updates: Partial<Theme>): Promise<Theme | null> {
    const theme = this.themes.get(id);
    if (!theme) return null;

    const updated = {
      ...theme,
      ...updates,
      id: theme.id, // Prevent ID change
    };

    this.themes.set(id, updated);
    await this.saveTheme(updated);

    this.emit('theme:updated', updated);
    return updated;
  }

  /**
   * Delete a theme
   */
  async deleteTheme(id: string): Promise<boolean> {
    // Don't allow deleting the current theme or default themes
    if (id === this.currentThemeId || id.startsWith('default-')) {
      return false;
    }

    const theme = this.themes.get(id);
    if (!theme) return false;

    this.themes.delete(id);

    // Delete from disk
    const filePath = path.join(this.themesDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // File might not exist
    }

    this.emit('theme:deleted', theme);
    return true;
  }

  /**
   * Get a theme by ID
   */
  getTheme(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  /**
   * Get all themes
   */
  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): Theme | undefined {
    return this.themes.get(this.currentThemeId);
  }

  /**
   * Set current theme
   */
  async setCurrentTheme(id: string): Promise<boolean> {
    const theme = this.themes.get(id);
    if (!theme) return false;

    this.currentThemeId = id;

    // Save current theme preference
    await this.savePreference('currentTheme', id);

    this.emit('theme:changed', theme);
    return true;
  }

  /**
   * Toggle favorite
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const theme = this.themes.get(id);
    if (!theme) return false;

    theme.favorite = !theme.favorite;
    await this.saveTheme(theme);

    this.emit('theme:favorite-toggled', theme);
    return theme.favorite;
  }

  /**
   * Get dark themes
   */
  getDarkThemes(): Theme[] {
    return this.getAllThemes().filter(t => t.dark);
  }

  /**
   * Get light themes
   */
  getLightThemes(): Theme[] {
    return this.getAllThemes().filter(t => !t.dark);
  }

  /**
   * Get favorite themes
   */
  getFavoriteThemes(): Theme[] {
    return this.getAllThemes().filter(t => t.favorite);
  }

  /**
   * Save theme to disk
   */
  private async saveTheme(theme: Theme): Promise<void> {
    const filePath = path.join(this.themesDir, `${theme.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(theme, null, 2), 'utf-8');
  }

  /**
   * Save preference
   */
  private async savePreference(key: string, value: any): Promise<void> {
    const prefsPath = path.join(this.themesDir, 'preferences.json');

    let prefs: Record<string, any> = {};
    try {
      const content = await fs.readFile(prefsPath, 'utf-8');
      prefs = JSON.parse(content);
    } catch {
      // Preferences file doesn't exist yet
    }

    prefs[key] = value;
    await fs.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
  }

  /**
   * Load preference
   */
  private async loadPreference(key: string): Promise<any> {
    const prefsPath = path.join(this.themesDir, 'preferences.json');

    try {
      const content = await fs.readFile(prefsPath, 'utf-8');
      const prefs = JSON.parse(content);
      return prefs[key];
    } catch {
      return null;
    }
  }

  /**
   * Export theme
   */
  async exportTheme(id: string, exportPath: string): Promise<boolean> {
    const theme = this.themes.get(id);
    if (!theme) return false;

    await fs.writeFile(exportPath, JSON.stringify(theme, null, 2), 'utf-8');
    return true;
  }

  /**
   * Import theme
   */
  async importTheme(importPath: string): Promise<Theme | null> {
    try {
      const content = await fs.readFile(importPath, 'utf-8');
      const data = JSON.parse(content);

      return await this.createTheme({
        id: data.id || `imported_${Date.now()}`,
        name: data.name,
        description: data.description,
        author: data.author,
        dark: data.dark,
        colors: data.colors,
      });
    } catch (error) {
      console.error('Error importing theme:', error);
      return null;
    }
  }
}

// Singleton instance
let themeManagerInstance: ThemeManager | null = null;

/**
 * Get the global theme manager
 */
export function getThemeManager(customDir?: string): ThemeManager {
  if (!themeManagerInstance) {
    themeManagerInstance = new ThemeManager(customDir);
  }
  return themeManagerInstance;
}
