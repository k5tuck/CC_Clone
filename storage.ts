import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const HOME = process.env.AGENT_HOME || (process.env.HOME || os.homedir()) + '/.local-agent';
const AGENTS_DIR = path.resolve(HOME, 'agents');
const CHECKPOINTS_DIR = path.resolve(HOME, 'checkpoints');
const META_FILE = path.resolve(HOME, 'meta.json');

export async function ensureDirs(){ 
  await fs.mkdir(AGENTS_DIR, { recursive: true });
  await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
  try{ await fs.access(META_FILE); } catch(e){ await fs.writeFile(META_FILE, JSON.stringify({ lastRestored: null }, null, 2)); }
}

export function agentPath(name:string){ return path.join(AGENTS_DIR, name + '.md'); }

export async function saveAgent(name:string, content:string){
  await ensureDirs();
  const p = agentPath(name);
  await fs.writeFile(p, content, 'utf-8');
  return p;
}

export async function loadAgent(name:string){
  const p = agentPath(name);
  const txt = await fs.readFile(p, 'utf-8');
  const parsed = require('gray-matter')(txt);
  return { meta: parsed.data, body: parsed.content, raw: txt };
}

export async function listAgents(){
  await ensureDirs();
  const items = await fs.readdir(AGENTS_DIR);
  return items.filter(s=>s.endsWith('.md')).map(s=>s.replace(/\.md$/, ''));
}

export async function saveCheckpoint(name:string, data:any){
  await ensureDirs();
  const p = path.join(CHECKPOINTS_DIR, name + '.json');
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
  return p;
}

export async function loadCheckpoint(name:string){
  const p = path.join(CHECKPOINTS_DIR, name + '.json');
  const txt = await fs.readFile(p, 'utf-8');
  return JSON.parse(txt);
}

export async function listCheckpoints(){ 
  await ensureDirs();
  const items = await fs.readdir(CHECKPOINTS_DIR);
  return items.filter(s=>s.endsWith('.json')).map(s=>s.replace(/\.json$/, ''));
}

export async function writeMeta(obj:any){
  await ensureDirs();
  const p = META_FILE;
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

export async function readMeta(){
  await ensureDirs();
  const txt = await fs.readFile(META_FILE, 'utf-8');
  return JSON.parse(txt);
}
