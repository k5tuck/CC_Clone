import fs from 'fs/promises';
import path from 'path';
import { agentPath, saveAgent, loadAgent } from './storage';
import { sessionReadFiles } from './session';
import { isTrusted } from './trust';

export type Role = 'admin' | 'writer' | 'analyst' | 'sub-agent';

export interface AgentMeta {
  name: string;
  role: Role;
  allowedTools?: string[];
}

export class Agent {
  meta: AgentMeta;
  constructor(meta: AgentMeta){
    this.meta = meta;
  }

  async readFile(filePath: string){
    await fs.access(filePath);
    if(!sessionReadFiles.has(this.meta.name)) sessionReadFiles.set(this.meta.name, new Set());
    sessionReadFiles.get(this.meta.name)?.add(filePath);
    const txt = await fs.readFile(filePath, 'utf-8');
    return txt;
  }

  async writeFile(filePath: string, content: string){
    // enforce pre-hook: must have read file first or confirm read
    if(!sessionReadFiles.has(this.meta.name)) sessionReadFiles.set(this.meta.name, new Set());
    const readSet = sessionReadFiles.get(this.meta.name)!;
    if(!readSet.has(filePath)){
      // for sub-agent writing orchestrator file -> reject
      if(this.meta.role === 'sub-agent' && filePath.includes('orchestrator')){
        throw new Error(\`Sub-agent \${this.meta.name} cannot write orchestrator file\`);
      }
      // otherwise, prompt user for confirmation (simplified for CLI)
      console.log(\`Agent \${this.meta.name} has not read \${filePath}. Reading now before write.\`);
      await this.readFile(filePath);
    }
    readSet.add(filePath);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async saveAgentFile(content:string){
    return saveAgent(this.meta.name, content);
  }

  async loadAgentFile(){
    return loadAgent(this.meta.name);
  }
}
