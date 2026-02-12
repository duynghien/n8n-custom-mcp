import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import path from 'path';
import crypto from 'crypto';
import { n8nApi } from './n8n-api-service.js';
import { handleApiError } from '../utils/error-handler.js';
import { validateSafePath, estimateJsonSize, SIZE_LIMITS } from '../utils/file-system-safety.js';
import type { N8nWorkflow } from '../types/n8n-types.js';

interface BackupMetadata {
  backupId: string;
  workflowId: string;
  timestamp: string;
  description: string;
  size: string;
  workflowName: string;
}

interface WorkflowDiff {
  added: string[];
  removed: string[];
  modified: string[];
  summary: string;
}

/**
 * Service for managing workflow backups
 * Storage: /backups/{workflowId}/{timestamp}.json
 */
export class BackupService {
  private backupRoot: string;

  constructor(backupRoot: string = '/app/backups') {
    this.backupRoot = backupRoot;
  }

  /**
   * Stream-write large JSON to file
   */
  private async streamWriteJson(
    filePath: string,
    data: any
  ): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    const readable = Readable.from([jsonString]);
    const writable = createWriteStream(filePath);

    await pipeline(readable, writable);
  }

  /**
   * Create backup snapshot of workflow
   */
  async backupWorkflow(
    workflowId: string,
    description?: string
  ): Promise<BackupMetadata> {
    try {
      // Sanitize workflow ID for path traversal protection
      const sanitizedId = this.sanitizeWorkflowId(workflowId);

      // Fetch workflow from n8n
      const workflow = await n8nApi.getWorkflow(workflowId);

      // Estimate size before processing
      const estimatedSize = estimateJsonSize(workflow);

      if (estimatedSize > SIZE_LIMITS.HARD_LIMIT) {
        throw new Error(
          `Workflow too large for backup: ~${Math.round(estimatedSize / 1024 / 1024)}MB ` +
          `(limit: ${SIZE_LIMITS.HARD_LIMIT / 1024 / 1024}MB)`
        );
      }

      if (estimatedSize > SIZE_LIMITS.WARN_THRESHOLD) {
        console.warn(
          `Large workflow detected: ~${Math.round(estimatedSize / 1024 / 1024)}MB. ` +
          `Using streaming write.`
        );
      }

      // Check disk space before backup
      await this.checkDiskSpace(workflow);

      // Generate backup ID with nonce to prevent race conditions
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const nonce = crypto.randomBytes(4).toString('hex');
      const backupId = `backup_${sanitizedId}_${timestamp}_${nonce}`;

      // Prepare storage paths
      const workflowDir = path.join(this.backupRoot, sanitizedId);

      // Validate path safety (symlink check)
      const pathCheck = await validateSafePath(workflowDir, this.backupRoot);
      if (!pathCheck.safe) {
        throw new Error(`Unsafe backup path: ${pathCheck.reason}`);
      }

      await fs.mkdir(workflowDir, { recursive: true });

      const backupPath = path.join(workflowDir, `${timestamp}_${nonce}.json`);
      const tempPath = `${backupPath}.tmp`;

      // Validate backup file path
      const filePathCheck = await validateSafePath(tempPath, this.backupRoot);
      if (!filePathCheck.safe) {
        throw new Error(`Unsafe backup file path: ${filePathCheck.reason}`);
      }

      // Save backup
      const backupData = {
        metadata: {
          backupId,
          workflowId,
          timestamp: new Date().toISOString(),
          description: description || 'Manual backup',
          workflowName: workflow.name,
        },
        workflow,
      };

      // Use streaming for large workflows
      if (estimatedSize > SIZE_LIMITS.STREAM_THRESHOLD) {
        await this.streamWriteJson(tempPath, backupData);
      } else {
        await fs.writeFile(tempPath, JSON.stringify(backupData, null, 2), 'utf-8');
      }

      await fs.rename(tempPath, backupPath);

      // Rotate old backups
      await this.rotateBackups(sanitizedId);

      // Get file size
      const stats = await fs.stat(backupPath);
      const size = this.formatFileSize(stats.size);

      return {
        backupId,
        workflowId,
        timestamp: backupData.metadata.timestamp,
        description: backupData.metadata.description,
        size,
        workflowName: workflow.name,
      };
    } catch (error) {
      throw handleApiError(error, `Failed to backup workflow ${workflowId}`);
    }
  }

  /**
   * List all backups for a workflow
   */
  async listBackups(workflowId: string): Promise<BackupMetadata[]> {
    try {
      const sanitizedId = this.sanitizeWorkflowId(workflowId);
      const workflowDir = path.join(this.backupRoot, sanitizedId);

      // Check if directory exists
      try {
        await fs.access(workflowDir);
      } catch {
        return []; // No backups yet
      }

      const files = await fs.readdir(workflowDir);
      const backups: BackupMetadata[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(workflowDir, file);
        const metadata = await this.getBackupMetadata(filePath);
        backups.push(metadata);
      }

      // Sort by timestamp descending (newest first)
      return backups.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      throw handleApiError(error, `Failed to list backups for workflow ${workflowId}`);
    }
  }

  /**
   * Restore workflow from backup
   */
  async restoreWorkflow(
    workflowId: string,
    backupId: string,
    autoBackupCurrent: boolean = true
  ): Promise<{ restored: boolean; currentBackup?: BackupMetadata }> {
    try {
      // Auto-backup current version before restore
      let currentBackup: BackupMetadata | undefined;
      if (autoBackupCurrent) {
        currentBackup = await this.backupWorkflow(workflowId, 'Auto-backup before restore');
      }

      // Find and load backup file
      const sanitizedId = this.sanitizeWorkflowId(workflowId);
      const backupPath = await this.findBackupPath(sanitizedId, backupId);
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);

      // Validate backup structure
      this.validateBackupStructure(backupData);

      // Restore workflow via n8n API
      await n8nApi.updateWorkflow(workflowId, backupData.workflow);

      return {
        restored: true,
        currentBackup,
      };
    } catch (error) {
      throw handleApiError(error, `Failed to restore workflow ${workflowId} from ${backupId}`);
    }
  }

  /**
   * Compare two workflow versions
   */
  async diffVersions(
    workflowId: string,
    backupId1: string,
    backupId2: string
  ): Promise<WorkflowDiff> {
    try {
      const [backup1Path, backup2Path] = await Promise.all([
        this.findBackupPath(workflowId, backupId1),
        this.findBackupPath(workflowId, backupId2),
      ]);

      const [content1, content2] = await Promise.all([
        fs.readFile(backup1Path, 'utf-8'),
        fs.readFile(backup2Path, 'utf-8'),
      ]);

      const workflow1: N8nWorkflow = JSON.parse(content1).workflow;
      const workflow2: N8nWorkflow = JSON.parse(content2).workflow;

      return this.compareWorkflows(workflow1, workflow2);
    } catch (error) {
      throw handleApiError(error, 'Failed to diff workflow versions');
    }
  }

  /**
   * Rotate backups, keeping only last N versions
   */
  async rotateBackups(workflowId: string, keepLast: number = 10): Promise<void> {
    try {
      const backups = await this.listBackups(workflowId);

      if (backups.length <= keepLast) return;

      // Delete oldest backups
      const toDelete = backups.slice(keepLast);
      const sanitizedId = this.sanitizeWorkflowId(workflowId);
      const workflowDir = path.join(this.backupRoot, sanitizedId);

      for (const backup of toDelete) {
        const { timestamp, nonce } = this.parseBackupId(backup.backupId);
        const filePath = path.join(workflowDir, `${timestamp}_${nonce}.json`);
        try {
          await fs.unlink(filePath);
        } catch (error: any) {
          // Handle locked/busy files gracefully
          if (error.code === 'EPERM' || error.code === 'EBUSY') {
            console.warn(`Skipping locked backup file: ${filePath}`);
            continue;
          }
          // Log other errors but continue rotation
          console.warn(`Failed to delete backup file ${filePath}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Failed to rotate backups:', error);
      // Don't throw - rotation failure shouldn't block backup creation
    }
  }

  /**
   * Get backup metadata from file
   */
  async getBackupMetadata(filePath: string): Promise<BackupMetadata> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const stats = await fs.stat(filePath);

    return {
      backupId: data.metadata.backupId,
      workflowId: data.metadata.workflowId,
      timestamp: data.metadata.timestamp,
      description: data.metadata.description,
      size: this.formatFileSize(stats.size),
      workflowName: data.metadata.workflowName,
    };
  }

  // ===== PRIVATE HELPERS =====

  private sanitizeWorkflowId(id: string): string {
    // Only allow alphanumeric, hyphens, underscores (prevent path traversal)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid workflow ID format: ${id}`);
    }
    return id;
  }

  private async checkDiskSpace(workflow: N8nWorkflow): Promise<void> {
    try {
      const estimatedSize = JSON.stringify(workflow).length * 1.2; // +20% buffer

      let availableBytes = 0;

      // Try fs.statfs first (Node.js 18.15+, cross-platform)
      try {
        const statfs = await fs.statfs(this.backupRoot);
        // statfs returns block size and available blocks
        availableBytes = statfs.bavail * statfs.bsize;
      } catch {
        // Fallback to df command on Unix systems
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const { stdout } = await execAsync(`df -k "${this.backupRoot}" | tail -1 | awk '{print $4}'`);
          const availableKB = parseInt(stdout.trim(), 10);
          if (!isNaN(availableKB)) {
            availableBytes = availableKB * 1024;
          }
        } catch {
          // Could not determine disk space, skip check
          console.warn('Could not determine available disk space, skipping check');
          return;
        }
      }

      if (availableBytes > 0 && availableBytes < estimatedSize + 100 * 1024 * 1024) {
        // Keep 100MB free
        throw new Error('Insufficient disk space for backup');
      }
    } catch (error) {
      // If disk check fails, log warning but continue
      console.warn('Could not check disk space:', error);
    }
  }

  private parseBackupId(backupId: string): { workflowId: string; timestamp: string; nonce: string } {
    // Format: backup_{workflowId}_{timestamp}_{nonce}
    const match = backupId.match(/^backup_(.+?)_(\d{4}-\d{2}-\d{2}T.+?)_([a-f0-9]{8})$/);
    if (!match) {
      throw new Error(`Invalid backup ID format: ${backupId}`);
    }
    return { workflowId: match[1], timestamp: match[2], nonce: match[3] };
  }

  private validateBackupStructure(backupData: any): void {
    if (!backupData?.metadata || !backupData?.workflow) {
      throw new Error('Corrupted backup file: missing metadata or workflow');
    }
    if (!backupData.workflow.nodes || !Array.isArray(backupData.workflow.nodes)) {
      throw new Error('Corrupted backup file: invalid workflow structure');
    }
  }

  private async findBackupPath(workflowId: string, backupId: string): Promise<string> {
    const workflowDir = path.join(this.backupRoot, workflowId);
    const { timestamp, nonce } = this.parseBackupId(backupId);
    const backupPath = path.join(workflowDir, `${timestamp}_${nonce}.json`);

    try {
      await fs.access(backupPath);
      return backupPath;
    } catch {
      throw new Error(`Backup ${backupId} not found for workflow ${workflowId}`);
    }
  }

  private compareWorkflows(wf1: N8nWorkflow, wf2: N8nWorkflow): WorkflowDiff {
    const nodes1 = new Set(wf1.nodes?.map((n) => n.name) || []);
    const nodes2 = new Set(wf2.nodes?.map((n) => n.name) || []);

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Find added nodes
    nodes2.forEach((name) => {
      if (!nodes1.has(name)) added.push(name);
    });

    // Find removed nodes
    nodes1.forEach((name) => {
      if (!nodes2.has(name)) removed.push(name);
    });

    // Find modified nodes (simple version - check if node config changed)
    nodes1.forEach((name) => {
      if (nodes2.has(name)) {
        const node1 = wf1.nodes?.find((n) => n.name === name);
        const node2 = wf2.nodes?.find((n) => n.name === name);
        if (JSON.stringify(node1) !== JSON.stringify(node2)) {
          modified.push(name);
        }
      }
    });

    const summary = this.generateDiffSummary({ added, removed, modified });

    return { added, removed, modified, summary };
  }

  private generateDiffSummary(diff: Omit<WorkflowDiff, 'summary'>): string {
    const parts: string[] = [];
    if (diff.added.length > 0) parts.push(`${diff.added.length} node(s) added`);
    if (diff.removed.length > 0) parts.push(`${diff.removed.length} node(s) removed`);
    if (diff.modified.length > 0) parts.push(`${diff.modified.length} node(s) modified`);

    return parts.length > 0 ? parts.join(', ') : 'No changes detected';
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

// Export singleton instance
export const backupService = new BackupService();
