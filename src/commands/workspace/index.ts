import { Command } from 'commander';
import { listCommand } from './list.js';
import { viewCommand } from './view.js';

export const workspaceCommand = new Command('workspace')
  .description('Work with workspaces')
  .addCommand(listCommand)
  .addCommand(viewCommand);
