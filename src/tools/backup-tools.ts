import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { backupService } from '../services/backup-service.js';
import { validateRequired } from '../utils/error-handler.js';

/**
 * Define all 4 backup management tools
 */
export const backupTools: Tool[] = [
  {
    name: 'backup_workflow',
    description: 'Create a backup snapshot of a workflow before making changes',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to backup',
        },
        description: {
          type: 'string',
          description: 'Optional description for this backup (e.g., "Before AI optimization")',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'list_workflow_backups',
    description: 'List all backup versions for a workflow with metadata (timestamp, size, description)',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to list backups for',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'restore_workflow',
    description: 'Restore a workflow to a previous backup version (auto-backups current state first)',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID to restore',
        },
        backupId: {
          type: 'string',
          description: 'Backup ID from list_workflow_backups (e.g., "backup_123_2026-02-11T10-30-00-000Z")',
        },
        autoBackupCurrent: {
          type: 'boolean',
          description: 'Auto-backup current version before restore (default: true)',
          default: true,
        },
      },
      required: ['workflowId', 'backupId'],
    },
  },
  {
    name: 'diff_workflow_versions',
    description: 'Compare two workflow backup versions to see what changed (nodes added/removed/modified)',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
        backupId1: {
          type: 'string',
          description: 'First backup ID to compare',
        },
        backupId2: {
          type: 'string',
          description: 'Second backup ID to compare',
        },
      },
      required: ['workflowId', 'backupId1', 'backupId2'],
    },
  },
];

/**
 * Handler for backup tool calls
 */
export async function handleBackupTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'backup_workflow':
      validateRequired(args, ['workflowId']);
      return await backupService.backupWorkflow(args.workflowId, args.description);

    case 'list_workflow_backups':
      validateRequired(args, ['workflowId']);
      return {
        backups: await backupService.listBackups(args.workflowId),
      };

    case 'restore_workflow':
      validateRequired(args, ['workflowId', 'backupId']);
      return await backupService.restoreWorkflow(
        args.workflowId,
        args.backupId,
        args.autoBackupCurrent ?? true
      );

    case 'diff_workflow_versions':
      validateRequired(args, ['workflowId', 'backupId1', 'backupId2']);
      return await backupService.diffVersions(
        args.workflowId,
        args.backupId1,
        args.backupId2
      );

    default:
      throw new Error(`Unknown backup tool: ${name}`);
  }
}
