#!/usr/bin/env node
import { Command } from 'commander';
import { Orchestrator } from './lib/orchestrator';
import { Agent } from './lib/agents';
import path from 'path';

const program = new Command();

program
  .command('init <projectDir>')
  .description('Initialize orchestrator for a project')
  .action(async (projectDir)=>{
    const orch = new Orchestrator({name:'main-orchestrator', role:'admin'}, projectDir);
    await orch.initMainFile();
    console.log('Orchestrator initialized at', orch.mainFile);
  });

program.parse(process.argv);
