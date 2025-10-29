#!/usr/bin/env ts-node
import React from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import inquirer from 'inquirer';
import path from 'path';
import { Orchestrator } from './lib/orchestrator';
import { Agent } from './lib/agents';
import { listTrusted, addTrusted } from './lib/trust';

const projectDir = process.cwd();
let orchestrator: Orchestrator | null = null;

const mainMenuItems = [
  { label: 'Initialize Orchestrator', value: 'init' },
  { label: 'Create Agent', value: 'create-agent' },
  { label: 'List Trusted Directories', value: 'list-trust' },
  { label: 'Add Trusted Directory', value: 'add-trust' },
  { label: 'Run Orchestrator Tasks', value: 'run-orch' },
  { label: 'Exit', value: 'exit' },
];

const handleSelect = async (item:any) => {
  switch(item.value){
    case 'init':
      orchestrator = new Orchestrator({name:'main-orchestrator', role:'admin'}, projectDir);
      await orchestrator.initMainFile();
      console.log('Orchestrator initialized at', orchestrator.mainFile);
      break;
    case 'create-agent':
      const answers = await inquirer.prompt([
        {name:'name', type:'input', message:'Agent name:'},
        {name:'role', type:'list', message:'Role:', choices:['admin','writer','analyst','sub-agent']}
      ]);
      const agent = new Agent({name:answers.name, role:answers.role});
      console.log('Created agent', agent.meta.name,'with role',agent.meta.role);
      break;
    case 'list-trust':
      const dirs = await listTrusted();
      console.log('Trusted directories:');
      dirs.forEach(d=>console.log('-',d));
      break;
    case 'add-trust':
      const dirAns = await inquirer.prompt([{name:'dir', type:'input', message:'Directory to trust:'}]);
      const newDirs = await addTrusted(dirAns.dir);
      console.log('Updated trusted directories:', newDirs);
      break;
    case 'run-orch':
      if(!orchestrator){ console.log('Initialize orchestrator first.'); break; }
      console.log('Orchestrator tasks running (demo)...');
      break;
    case 'exit':
      process.exit(0);
  }
  render(<MainMenu />);
};

const MainMenu = () => <SelectInput items={mainMenuItems} onSelect={handleSelect}/>;

render(<MainMenu />);
