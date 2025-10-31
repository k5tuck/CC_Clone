import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { Skill, SkillMetadata, SkillError } from './types';

export class SkillLoader {
  private skillsDirectory: string;
  private loadedSkills: Map<string, Skill> = new Map();

  constructor(skillsDirectory: string = './skills') {
    this.skillsDirectory = skillsDirectory;
  }

  /**
   * Load all skills from the skills directory
   */
  async loadAll(): Promise<Skill[]> {
    try {
      const entries = await fs.readdir(this.skillsDirectory, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory());

      const skills: Skill[] = [];
      for (const dir of skillDirs) {
        try {
          const skill = await this.loadSkill(dir.name);
          skills.push(skill);
          this.loadedSkills.set(skill.metadata.name, skill);
        } catch (error) {
          console.error(`Failed to load skill ${dir.name}:`, error);
        }
      }

      console.log(`Loaded ${skills.length} skills`);
      return skills;
    } catch (error) {
      throw new SkillError(
        'Failed to load skills directory',
        'system',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load a single skill by name
   */
  async loadSkill(skillName: string): Promise<Skill> {
    const skillPath = path.join(this.skillsDirectory, skillName);
    const skillFile = path.join(skillPath, 'SKILL.md');

    try {
      // Check if skill exists
      await fs.access(skillFile);

      // Read and parse SKILL.md
      const content = await fs.readFile(skillFile, 'utf-8');
      const { data, content: body } = matter(content);

      // Validate required metadata
      if (!data.name || !data.description) {
        throw new SkillError(
          'Skill missing required metadata: name and description',
          skillName
        );
      }

      const metadata: SkillMetadata = {
        name: data.name,
        version: data.version || '1.0.0',
        description: data.description,
        author: data.author,
        tags: data.tags || [],
        activation_keywords: data.activation_keywords || [],
        dependencies: data.dependencies || [],
        requires_code_execution: data.requires_code_execution || false,
      };

      // Load templates
      const templates = await this.loadDirectory(
        path.join(skillPath, 'templates')
      );

      // Load scripts
      const scripts = await this.loadDirectory(
        path.join(skillPath, 'scripts')
      );

      // Load resources (images, data files, etc.)
      const resources = await this.loadResources(
        path.join(skillPath, 'resources')
      );

      return {
        metadata,
        content: body,
        path: skillPath,
        templates,
        scripts,
        resources,
      };
    } catch (error) {
      throw new SkillError(
        `Failed to load skill: ${skillName}`,
        skillName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load all text files from a directory
   */
  private async loadDirectory(dirPath: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          files.set(entry.name, content);
        }
      }
    } catch (error) {
      // Directory doesn't exist, return empty map
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Warning: Could not load directory ${dirPath}:`, error);
      }
    }

    return files;
  }

  /**
   * Load binary resources
   */
  private async loadResources(dirPath: string): Promise<Map<string, Buffer>> {
    const resources = new Map<string, Buffer>();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const content = await fs.readFile(filePath);
          resources.set(entry.name, content);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Warning: Could not load resources ${dirPath}:`, error);
      }
    }

    return resources;
  }

  /**
   * Get a loaded skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.loadedSkills.get(name);
  }

  /**
   * List all loaded skills with minimal info
   */
  listSkills(): Array<{ name: string; description: string }> {
    return Array.from(this.loadedSkills.values()).map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description,
    }));
  }

  /**
   * Reload a specific skill
   */
  async reloadSkill(skillName: string): Promise<Skill> {
    const skill = await this.loadSkill(skillName);
    this.loadedSkills.set(skillName, skill);
    return skill;
  }
}