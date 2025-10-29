import fs from 'fs/promises';
import os from 'os';
import path from 'path';
const HOME = process.env.AGENT_HOME || (process.env.HOME || os.homedir()) + '/.local-agent';
const TRUST = path.join(HOME, 'trusted.json');

export async function ensureTrustFile(){
  await fs.mkdir(path.dirname(TRUST), { recursive: true });
  try {
    await fs.access(TRUST);
  } catch(e){
    await fs.writeFile(TRUST, JSON.stringify({ dirs: [] }, null, 2), 'utf-8');
  }
}

export async function listTrusted(){
  await ensureTrustFile();
  const txt = await fs.readFile(TRUST, 'utf-8');
  const obj = JSON.parse(txt);
  return obj.dirs || [];
}

export async function addTrusted(dir:string){
  await ensureTrustFile();
  const dirs = await listTrusted();
  if(!dirs.includes(dir)) dirs.push(dir);
  await fs.writeFile(TRUST, JSON.stringify({ dirs }, null, 2), 'utf-8');
  return dirs;
}

export async function isTrusted(dir:string){
  const dirs = await listTrusted();
  return dirs.includes(dir);
}

export async function removeTrusted(dir:string){
  const dirs = await listTrusted();
  const n = dirs.filter(d=>d!==dir);
  await fs.writeFile(TRUST, JSON.stringify({ dirs: n }, null, 2), 'utf-8');
  return n;
}
