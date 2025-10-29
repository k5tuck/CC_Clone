import path from 'path';
import fs from 'fs/promises';
import { Agent } from './agents';

export class Orchestrator extends Agent{
  mainFile: string;
  constructor(meta: Parameters<typeof Agent>[0], projectDir:string){
    super(meta);
    const ts = Date.now();
    this.mainFile = path.join(projectDir, '.local-agent', `orchestrator_${ts}.md`);
  }

  async initMainFile(){
    await fs.mkdir(path.dirname(this.mainFile), { recursive:true });
    await fs.writeFile(this.mainFile, '# Context\n\n# Sub-agent Responses\n\n# Original Content\n','utf-8');
  }

  async updateContext(section:string, content:string){
    let txt = await fs.readFile(this.mainFile, 'utf-8');
    txt += `\n## ${section}\n${content}\n`;
    await fs.writeFile(this.mainFile, txt,'utf-8');
  }

  async summarizeSubAgent(subAgentFile:string){
    const subTxt = await fs.readFile(subAgentFile,'utf-8');
    await this.updateContext('Sub-agent Summary', subTxt);
  }
}
