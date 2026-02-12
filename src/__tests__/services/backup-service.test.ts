import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from '../../services/backup-service.js';
import { n8nApi } from '../../services/n8n-api-service.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock fs and n8nApi
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      readFile: vi.fn(),
      readdir: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      lstat: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

vi.mock('../../services/n8n-api-service.js', () => ({
  n8nApi: {
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
  },
}));

describe('BackupService', () => {
  let service: BackupService;
  const backupRoot = '/tmp/backups';

  // Helper to generate valid backup IDs
  const makeBackupId = (workflowId: string, timestamp: string) => {
    return `backup_${workflowId}_${timestamp}_abc12345`;
  };

  beforeEach(() => {
    service = new BackupService(backupRoot);
    vi.clearAllMocks();
    // Mock lstat to return file/directory stats
    vi.mocked(fs.lstat).mockResolvedValue({
      isSymbolicLink: () => false,
      isFile: () => true,
      isDirectory: () => false,
    } as any);
  });

  describe('backupWorkflow', () => {
    it('should create a backup successfully', async () => {
      const workflowId = '123';
      const mockWorkflow = { id: '123', name: 'Test Workflow', nodes: [] };
      vi.mocked(n8nApi.getWorkflow).mockResolvedValue(mockWorkflow);
      vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await service.backupWorkflow(workflowId, 'Initial backup');

      expect(n8nApi.getWorkflow).toHaveBeenCalledWith(workflowId);
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(backupRoot, workflowId), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result.workflowId).toBe(workflowId);
      expect(result.description).toBe('Initial backup');
      expect(result.size).toBe('1.0KB');
    });

    it('should handle API errors during backup', async () => {
      vi.mocked(n8nApi.getWorkflow).mockRejectedValue(new Error('API Error'));
      await expect(service.backupWorkflow('123')).rejects.toThrow('Failed to backup workflow 123');
    });
  });

  describe('listBackups', () => {
    it('should list and sort backups by timestamp descending', async () => {
      const workflowId = '123';
      const files = ['2026-02-11T10-00-00-000Z_abc12345.json', '2026-02-11T11-00-00-000Z_abc12345.json'];
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(files as any);

      const mockMetadata1 = {
        metadata: {
          backupId: makeBackupId('123', '2026-02-11T10-00-00-000Z'),
          workflowId: '123',
          timestamp: '2026-02-11T10:00:00.000Z',
          description: 'First',
          workflowName: 'Test',
        }
      };
      const mockMetadata2 = {
        metadata: {
          backupId: makeBackupId('123', '2026-02-11T11-00-00-000Z'),
          workflowId: '123',
          timestamp: '2026-02-11T11:00:00.000Z',
          description: 'Second',
          workflowName: 'Test',
        }
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockMetadata1))
        .mockResolvedValueOnce(JSON.stringify(mockMetadata2));
      vi.mocked(fs.stat).mockResolvedValue({ size: 512 } as any);

      const result = await service.listBackups(workflowId);

      expect(result).toHaveLength(2);
      expect(result[0].backupId).toBe(makeBackupId('123', '2026-02-11T11-00-00-000Z')); // Newest first
      expect(result[1].backupId).toBe(makeBackupId('123', '2026-02-11T10-00-00-000Z'));
    });

    it('should return empty array if no backups directory exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      const result = await service.listBackups('123');
      expect(result).toEqual([]);
    });
  });

  describe('restoreWorkflow', () => {
    it('should restore a workflow and create auto-backup', async () => {
      const workflowId = '123';
      const backupId = makeBackupId('123', '2026-02-11T10-00-00-000Z');
      const mockBackupData = {
        metadata: { backupId, workflowId, timestamp: '2026-02-11T10:00:00.000Z', description: 'Test', workflowName: 'Test' },
        workflow: { id: '123', name: 'Restored', nodes: [] }
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockBackupData));
      vi.mocked(n8nApi.getWorkflow).mockResolvedValue({ id: '123', name: 'Current', nodes: [] });
      vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await service.restoreWorkflow(workflowId, backupId, true);

      expect(n8nApi.updateWorkflow).toHaveBeenCalledWith(workflowId, mockBackupData.workflow);
      expect(n8nApi.getWorkflow).toHaveBeenCalled(); // From auto-backup
      expect(result.restored).toBe(true);
      expect(result.currentBackup).toBeDefined();
    });
  });

  describe('diffVersions', () => {
    it('should detect added, removed, and modified nodes', async () => {
      const workflowId = '123';
      const backup1Id = makeBackupId('123', '2026-02-11T10-00-00-000Z');
      const backup2Id = makeBackupId('123', '2026-02-11T11-00-00-000Z');
      const backup1 = {
        metadata: { backupId: backup1Id, workflowId, timestamp: '2026-02-11T10:00:00.000Z', description: '', workflowName: 'Test' },
        workflow: {
          nodes: [
            { name: 'Node 1', type: 't1', position: [0, 0] },
            { name: 'Node 2', type: 't2', position: [0, 0] },
          ]
        }
      };
      const backup2 = {
        metadata: { backupId: backup2Id, workflowId, timestamp: '2026-02-11T11:00:00.000Z', description: '', workflowName: 'Test' },
        workflow: {
          nodes: [
            { name: 'Node 1', type: 't1', position: [10, 10] }, // Modified
            { name: 'Node 3', type: 't3', position: [0, 0] }, // Added
          ]
        }
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(backup1))
        .mockResolvedValueOnce(JSON.stringify(backup2));

      const result = await service.diffVersions(workflowId, backup1Id, backup2Id);

      expect(result.added).toContain('Node 3');
      expect(result.removed).toContain('Node 2');
      expect(result.modified).toContain('Node 1');
      expect(result.summary).toContain('1 node(s) added');
      expect(result.summary).toContain('1 node(s) removed');
      expect(result.summary).toContain('1 node(s) modified');
    });
  });

  describe('rotateBackups', () => {
    it('should delete oldest backups exceeding limit', async () => {
      const workflowId = '123';
      const backups = Array.from({ length: 12 }, (_, i) => ({
        backupId: makeBackupId('123', `2026-02-11T10-00-0${String(i).padStart(2, '0')}-000Z`),
        timestamp: new Date(2026, 1, 11, 10, 0, i).toISOString(),
        workflowId,
        description: '',
        size: '1KB',
        workflowName: 'Test'
      })).reverse(); // Newest first

      vi.spyOn(service, 'listBackups').mockResolvedValue(backups);

      await service.rotateBackups(workflowId, 10);

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });
});
