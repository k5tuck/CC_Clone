import path from 'path';
import fs from 'fs/promises';
import { Agent, AgentMeta } from '../agent';
import { OllamaClient, OllamaConfig } from '../llm/ollama-client';

export class Orchestrator extends Agent{
  mainFile: string;

  constructor(meta: AgentMeta, projectDir: string) {
    // 1️⃣ Create Ollama client
    const ollamaConfig: OllamaConfig = {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.1:latest',
      temperature: 0.7,
      timeout: 120000,
      maxRetries: 3,
    };
    const llm = new OllamaClient(ollamaConfig);

    // 2️⃣ Call parent constructor with required args
    super(meta, llm, 10); // maxIterations = 10

    // 3️⃣ Set mainFile path
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
