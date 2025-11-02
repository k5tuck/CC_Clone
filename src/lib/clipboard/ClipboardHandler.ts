/**
 * Clipboard Handler
 * Handles clipboard operations including image pasting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Clipboard content type
 */
export enum ClipboardContentType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  UNKNOWN = 'unknown',
}

/**
 * Clipboard content
 */
export interface ClipboardContent {
  type: ClipboardContentType;
  data: string | Buffer;
  mimeType?: string;
  fileName?: string;
  size?: number;
}

/**
 * Image paste result
 */
export interface ImagePasteResult {
  success: boolean;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  size?: number;
  error?: string;
}

/**
 * Clipboard Handler Class
 */
export class ClipboardHandler {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'selek-clipboard');
  }

  /**
   * Ensures temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  /**
   * Detects clipboard content type
   */
  async detectContentType(): Promise<ClipboardContentType> {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        // macOS - check using osascript
        const { stdout } = await execAsync(
          'osascript -e "clipboard info"'
        );

        if (stdout.includes('«class PNGf»') || stdout.includes('public.png')) {
          return ClipboardContentType.IMAGE;
        }
        if (stdout.includes('«class furl»') || stdout.includes('public.file-url')) {
          return ClipboardContentType.FILE;
        }
        return ClipboardContentType.TEXT;
      } else if (platform === 'linux') {
        // Linux - check using xclip
        const { stdout } = await execAsync('xclip -selection clipboard -t TARGETS -o');

        if (stdout.includes('image/png') || stdout.includes('image/jpeg')) {
          return ClipboardContentType.IMAGE;
        }
        return ClipboardContentType.TEXT;
      } else if (platform === 'win32') {
        // Windows - use PowerShell
        const { stdout } = await execAsync(
          'powershell -command "Get-Clipboard -Format Image"'
        );

        if (stdout && stdout.length > 0) {
          return ClipboardContentType.IMAGE;
        }
        return ClipboardContentType.TEXT;
      }
    } catch (error) {
      console.error('Error detecting clipboard type:', error);
    }

    return ClipboardContentType.UNKNOWN;
  }

  /**
   * Reads text from clipboard
   */
  async readText(): Promise<string> {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        const { stdout } = await execAsync('pbpaste');
        return stdout;
      } else if (platform === 'linux') {
        const { stdout } = await execAsync('xclip -selection clipboard -o');
        return stdout;
      } else if (platform === 'win32') {
        const { stdout } = await execAsync('powershell -command "Get-Clipboard"');
        return stdout;
      }
    } catch (error) {
      console.error('Error reading clipboard text:', error);
    }

    return '';
  }

  /**
   * Reads image from clipboard
   */
  async readImage(): Promise<ImagePasteResult> {
    const platform = process.platform;
    await this.ensureTempDir();

    const timestamp = Date.now();
    const tempFile = path.join(this.tempDir, `clipboard-${timestamp}.png`);

    try {
      if (platform === 'darwin') {
        // macOS - use osascript to save clipboard image
        await execAsync(`osascript -e 'set png_data to the clipboard as «class PNGf»' -e 'set the_file to open for access POSIX file "${tempFile}" with write permission' -e 'write png_data to the_file' -e 'close access the_file'`);
      } else if (platform === 'linux') {
        // Linux - use xclip
        await execAsync(`xclip -selection clipboard -t image/png -o > "${tempFile}"`);
      } else if (platform === 'win32') {
        // Windows - use PowerShell with Add-Type for image handling
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $img = [Windows.Forms.Clipboard]::GetImage()
          if ($img) {
            $img.Save("${tempFile.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
          }
        `;
        await execAsync(`powershell -command "${psScript}"`);
      }

      // Check if file was created
      const stats = await fs.stat(tempFile);

      if (stats.size === 0) {
        await fs.unlink(tempFile);
        return {
          success: false,
          error: 'Clipboard is empty or does not contain an image',
        };
      }

      // Read file as base64
      const buffer = await fs.readFile(tempFile);
      const base64 = buffer.toString('base64');

      // Get image dimensions (basic check)
      // For PNG, dimensions are at bytes 16-23
      let width, height;
      if (buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG signature
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      }

      return {
        success: true,
        filePath: tempFile,
        base64,
        mimeType: 'image/png',
        width,
        height,
        size: stats.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error reading image',
      };
    }
  }

  /**
   * Writes text to clipboard
   */
  async writeText(text: string): Promise<boolean> {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        await execAsync(`echo "${text}" | pbcopy`);
      } else if (platform === 'linux') {
        await execAsync(`echo "${text}" | xclip -selection clipboard`);
      } else if (platform === 'win32') {
        await execAsync(`echo "${text}" | clip`);
      }
      return true;
    } catch (error) {
      console.error('Error writing to clipboard:', error);
      return false;
    }
  }

  /**
   * Cleans up old temp files
   */
  async cleanup(olderThanMs: number = 3600000): Promise<void> {
    try {
      await this.ensureTempDir();
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > olderThanMs) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}

// Global instance
let globalHandler: ClipboardHandler | null = null;

/**
 * Gets the global clipboard handler instance
 */
export function getClipboardHandler(): ClipboardHandler {
  if (!globalHandler) {
    globalHandler = new ClipboardHandler();
  }
  return globalHandler;
}
