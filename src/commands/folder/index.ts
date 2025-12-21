import { Command } from 'commander';
import { listCommand } from './list.js';
import { viewCommand } from './view.js';

export const folderCommand = new Command('folder')
  .description('Work with folders')
  .addCommand(listCommand)
  .addCommand(viewCommand);
