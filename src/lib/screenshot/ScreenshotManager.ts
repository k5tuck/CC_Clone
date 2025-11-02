/**
 * Screenshot Manager
 * Capture and save TUI screenshots for documentation and sharing
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Screenshot format
 */
export enum ScreenshotFormat {
  PNG = 'png',
  SVG = 'svg',
  HTML = 'html',
  TEXT = 'txt',
  ANSI = 'ansi',
}

/**
 * Screenshot metadata
 */
export interface ScreenshotMetadata {
  id: string;
  filename: string;
  format: ScreenshotFormat;
  timestamp: Date;
  dimensions?: {
    width: number;
    height: number;
  };
  tags: string[];
  description?: string;
  context?: string;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  format?: ScreenshotFormat;
  filename?: string;
  description?: string;
  tags?: string[];
  includeContext?: boolean;
  copyToClipboard?: boolean;
}

/**
 * Screenshot Manager
 */
export class ScreenshotManager extends EventEmitter {
  private screenshotsDir: string;
  private screenshots: Map<string, ScreenshotMetadata> = new Map();

  constructor(customDir?: string) {
    super();
    this.screenshotsDir = customDir || path.join(os.homedir(), '.selek', 'screenshots');
  }

  /**
   * Initialize screenshot manager
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.screenshotsDir, { recursive: true });
    await this.loadMetadata();
    this.emit('initialized');
  }

  /**
   * Capture a screenshot
   *
   * Note: Actual screenshot capture depends on terminal capabilities.
   * This provides the infrastructure and metadata management.
   */
  async captureScreenshot(options: ScreenshotOptions = {}): Promise<string> {
    const format = options.format || ScreenshotFormat.PNG;
    const timestamp = new Date();
    const id = `screenshot_${timestamp.getTime()}`;
    const filename = options.filename || `${id}.${format}`;
    const filepath = path.join(this.screenshotsDir, filename);

    // Create metadata
    const metadata: ScreenshotMetadata = {
      id,
      filename,
      format,
      timestamp,
      tags: options.tags || [],
      description: options.description,
      context: options.includeContext ? this.captureContext() : undefined,
    };

    try {
      // Capture screenshot based on format
      switch (format) {
        case ScreenshotFormat.PNG:
          await this.capturePNG(filepath);
          break;
        case ScreenshotFormat.SVG:
          await this.captureSVG(filepath);
          break;
        case ScreenshotFormat.HTML:
          await this.captureHTML(filepath);
          break;
        case ScreenshotFormat.TEXT:
        case ScreenshotFormat.ANSI:
          await this.captureText(filepath, format === ScreenshotFormat.ANSI);
          break;
      }

      // Save metadata
      this.screenshots.set(id, metadata);
      await this.saveMetadata();

      // Copy to clipboard if requested
      if (options.copyToClipboard) {
        await this.copyToClipboard(filepath);
      }

      this.emit('screenshot:captured', metadata);

      return filepath;
    } catch (error) {
      this.emit('screenshot:error', { error, metadata });
      throw error;
    }
  }

  /**
   * Get all screenshots
   */
  getScreenshots(): ScreenshotMetadata[] {
    return Array.from(this.screenshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get screenshot by ID
   */
  getScreenshot(id: string): ScreenshotMetadata | undefined {
    return this.screenshots.get(id);
  }

  /**
   * Search screenshots
   */
  searchScreenshots(query: string, tags?: string[]): ScreenshotMetadata[] {
    let results = Array.from(this.screenshots.values());

    // Filter by tags
    if (tags && tags.length > 0) {
      results = results.filter(s =>
        tags.some(tag => s.tags.includes(tag))
      );
    }

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(s =>
        s.filename.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery) ||
        s.context?.toLowerCase().includes(lowerQuery)
      );
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Delete screenshot
   */
  async deleteScreenshot(id: string): Promise<boolean> {
    const screenshot = this.screenshots.get(id);
    if (!screenshot) return false;

    try {
      const filepath = path.join(this.screenshotsDir, screenshot.filename);
      await fs.unlink(filepath);
      this.screenshots.delete(id);
      await this.saveMetadata();

      this.emit('screenshot:deleted', screenshot);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update screenshot metadata
   */
  async updateScreenshot(id: string, updates: Partial<ScreenshotMetadata>): Promise<void> {
    const screenshot = this.screenshots.get(id);
    if (!screenshot) return;

    Object.assign(screenshot, updates);
    await this.saveMetadata();

    this.emit('screenshot:updated', screenshot);
  }

  /**
   * Export screenshot with annotations
   */
  async exportScreenshot(id: string, outputPath: string): Promise<void> {
    const screenshot = this.screenshots.get(id);
    if (!screenshot) throw new Error('Screenshot not found');

    const sourcePath = path.join(this.screenshotsDir, screenshot.filename);
    await fs.copyFile(sourcePath, outputPath);

    // Also export metadata as sidecar file
    const metadataPath = outputPath.replace(/\.[^.]+$/, '.meta.json');
    await fs.writeFile(metadataPath, JSON.stringify(screenshot, null, 2));

    this.emit('screenshot:exported', { screenshot, outputPath });
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const screenshots = Array.from(this.screenshots.values());

    const byFormat = new Map<ScreenshotFormat, number>();
    for (const screenshot of screenshots) {
      byFormat.set(screenshot.format, (byFormat.get(screenshot.format) || 0) + 1);
    }

    const allTags = screenshots.flatMap(s => s.tags);
    const tagCounts = new Map<string, number>();
    for (const tag of allTags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    return {
      totalScreenshots: screenshots.length,
      byFormat,
      topTags: Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      oldestScreenshot: screenshots.length > 0
        ? screenshots.reduce((oldest, s) =>
            s.timestamp < oldest.timestamp ? s : oldest
          ).timestamp
        : null,
      newestScreenshot: screenshots.length > 0
        ? screenshots.reduce((newest, s) =>
            s.timestamp > newest.timestamp ? s : newest
          ).timestamp
        : null,
    };
  }

  /**
   * Capture context information
   */
  private captureContext(): string {
    return JSON.stringify({
      cwd: process.cwd(),
      platform: process.platform,
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Capture PNG screenshot
   */
  private async capturePNG(filepath: string): Promise<void> {
    // Platform-specific screenshot commands
    let command: string;

    switch (process.platform) {
      case 'darwin': // macOS
        command = `screencapture -i "${filepath}"`;
        break;
      case 'linux':
        command = `gnome-screenshot -f "${filepath}"`;
        break;
      case 'win32': // Windows
        command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}');"`;
        break;
      default:
        throw new Error(`Screenshot not supported on platform: ${process.platform}`);
    }

    // Note: This captures the screen, not just the terminal
    // For terminal-only capture, we'd need terminal-specific tools
    await execAsync(command);
  }

  /**
   * Capture SVG screenshot
   */
  private async captureSVG(filepath: string): Promise<void> {
    // SVG capture requires terminal rendering to SVG
    // This is a placeholder - actual implementation would use terminal-to-svg tools
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <rect width="100%" height="100%" fill="#1e1e1e"/>
  <text x="50%" y="50%" text-anchor="middle" fill="#ffffff" font-family="monospace">
    Terminal Screenshot (SVG format)
  </text>
</svg>`;
    await fs.writeFile(filepath, svg);
  }

  /**
   * Capture HTML screenshot
   */
  private async captureHTML(filepath: string): Promise<void> {
    // HTML capture with terminal styling
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Terminal Screenshot</title>
  <style>
    body {
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Courier New', monospace;
      padding: 20px;
      margin: 0;
    }
    .terminal {
      background: #1e1e1e;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 10px;
    }
  </style>
</head>
<body>
  <div class="terminal">
    <pre>Terminal Screenshot (HTML format)
Captured: ${new Date().toISOString()}</pre>
  </div>
</body>
</html>`;
    await fs.writeFile(filepath, html);
  }

  /**
   * Capture text screenshot
   */
  private async captureText(filepath: string, includeANSI: boolean): Promise<void> {
    // Capture current terminal buffer
    // This is a simplified version - real implementation would capture actual terminal state
    const content = `Terminal Screenshot
Captured: ${new Date().toISOString()}
Format: ${includeANSI ? 'ANSI' : 'Plain Text'}

[Terminal content would be captured here]
`;
    await fs.writeFile(filepath, content);
  }

  /**
   * Copy file to clipboard
   */
  private async copyToClipboard(filepath: string): Promise<void> {
    let command: string;

    switch (process.platform) {
      case 'darwin':
        command = `cat "${filepath}" | pbcopy`;
        break;
      case 'linux':
        command = `xclip -selection clipboard -t image/png -i "${filepath}"`;
        break;
      case 'win32':
        command = `powershell -Command "Get-Content '${filepath}' | Set-Clipboard"`;
        break;
      default:
        return;
    }

    try {
      await execAsync(command);
    } catch {
      // Clipboard copy failed, but don't throw - screenshot was still saved
    }
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata(): Promise<void> {
    try {
      const metadataFile = path.join(this.screenshotsDir, 'metadata.json');
      const content = await fs.readFile(metadataFile, 'utf-8');
      const data = JSON.parse(content);

      for (const item of data) {
        const metadata: ScreenshotMetadata = {
          ...item,
          timestamp: new Date(item.timestamp),
        };
        this.screenshots.set(metadata.id, metadata);
      }
    } catch {
      // Metadata file doesn't exist yet
    }
  }

  /**
   * Save metadata to disk
   */
  private async saveMetadata(): Promise<void> {
    const metadataFile = path.join(this.screenshotsDir, 'metadata.json');
    await fs.writeFile(
      metadataFile,
      JSON.stringify(Array.from(this.screenshots.values()), null, 2)
    );
  }
}

// Singleton instance
let screenshotManagerInstance: ScreenshotManager | null = null;

/**
 * Get the global screenshot manager
 */
export function getScreenshotManager(): ScreenshotManager {
  if (!screenshotManagerInstance) {
    screenshotManagerInstance = new ScreenshotManager();
  }
  return screenshotManagerInstance;
}
