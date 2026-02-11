import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBackupTool } from '../../tools/backup-tools.js';
import { backupService } from '../../services/backup-service.js';

vi.mock('../../services/backup-service.js', () => ({
  backupService: {
    backupWorkflow: vi.fn(),
    listBackups: vi.fn(),
    restoreWorkflow: vi.fn(),
    diffVersions: vi.fn(),
  },
}));

describe('Backup Tools Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call backupWorkflow for backup_workflow tool', async () => {
    const args = { workflowId: '123', description: 'Test' };
    await handleBackupTool('backup_workflow', args);
    expect(backupService.backupWorkflow).toHaveBeenCalledWith('123', 'Test');
  });

  it('should call listBackups for list_workflow_backups tool', async () => {
    const args = { workflowId: '123' };
    await handleBackupTool('list_workflow_backups', args);
    expect(backupService.listBackups).toHaveBeenCalledWith('123');
  });

  it('should call restoreWorkflow for restore_workflow tool', async () => {
    const args = { workflowId: '123', backupId: 'b1', autoBackupCurrent: false };
    await handleBackupTool('restore_workflow', args);
    expect(backupService.restoreWorkflow).toHaveBeenCalledWith('123', 'b1', false);
  });

  it('should call diffVersions for diff_workflow_versions tool', async () => {
    const args = { workflowId: '123', backupId1: 'b1', backupId2: 'b2' };
    await handleBackupTool('diff_workflow_versions', args);
    expect(backupService.diffVersions).toHaveBeenCalledWith('123', 'b1', 'b2');
  });

  it('should throw error for unknown tool', async () => {
    await expect(handleBackupTool('unknown_tool', {})).rejects.toThrow('Unknown backup tool: unknown_tool');
  });

  it('should validate required arguments', async () => {
    await expect(handleBackupTool('backup_workflow', {})).rejects.toThrow();
  });
});
