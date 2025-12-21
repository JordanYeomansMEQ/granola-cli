import { Command } from 'commander';
import { enhancedCommand } from './enhanced.js';
import { exportCommand } from './export.js';
import { listCommand } from './list.js';
import { notesCommand } from './notes.js';
import { transcriptCommand } from './transcript.js';
import { viewCommand } from './view.js';

export const meetingCommand = new Command('meeting')
  .description('Work with meetings')
  .addCommand(listCommand)
  .addCommand(viewCommand)
  .addCommand(notesCommand)
  .addCommand(enhancedCommand)
  .addCommand(transcriptCommand)
  .addCommand(exportCommand);
