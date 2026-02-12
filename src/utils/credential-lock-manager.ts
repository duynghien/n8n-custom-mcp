/**
 * In-memory lock manager for credentials during workflow execution
 * Prevents deletion of credentials while workflows are using them
 */
class CredentialLockManager {
  // Map: credentialId -> Set of executionIds holding the lock
  private locks = new Map<string, Set<string>>();

  // Map: executionId -> Set of credentialIds it holds
  private executionLocks = new Map<string, Set<string>>();

  // Lock timeout (15 minutes) to prevent zombie locks
  private readonly LOCK_TIMEOUT_MS = 15 * 60 * 1000;
  private lockTimestamps = new Map<string, number>();

  /**
   * Acquire lock on credential for an execution
   */
  acquireLock(credentialId: string, executionId: string): void {
    // Initialize sets if needed
    if (!this.locks.has(credentialId)) {
      this.locks.set(credentialId, new Set());
    }
    if (!this.executionLocks.has(executionId)) {
      this.executionLocks.set(executionId, new Set());
    }

    // Add lock
    this.locks.get(credentialId)!.add(executionId);
    this.executionLocks.get(executionId)!.add(credentialId);

    // Record timestamp
    const lockKey = `${credentialId}:${executionId}`;
    this.lockTimestamps.set(lockKey, Date.now());
  }

  /**
   * Release lock on credential for an execution
   */
  releaseLock(credentialId: string, executionId: string): void {
    const credLocks = this.locks.get(credentialId);
    if (credLocks) {
      credLocks.delete(executionId);
      if (credLocks.size === 0) {
        this.locks.delete(credentialId);
      }
    }

    const execLocks = this.executionLocks.get(executionId);
    if (execLocks) {
      execLocks.delete(credentialId);
      if (execLocks.size === 0) {
        this.executionLocks.delete(executionId);
      }
    }

    const lockKey = `${credentialId}:${executionId}`;
    this.lockTimestamps.delete(lockKey);
  }

  /**
   * Release all locks for an execution (cleanup on completion)
   */
  releaseAllForExecution(executionId: string): void {
    const credIds = this.executionLocks.get(executionId);
    if (!credIds) return;

    for (const credId of credIds) {
      this.releaseLock(credId, executionId);
    }
  }

  /**
   * Check if credential is locked (with stale lock cleanup)
   */
  isLocked(credentialId: string): boolean {
    this.cleanupStaleLocks(credentialId);

    const locks = this.locks.get(credentialId);
    return locks !== undefined && locks.size > 0;
  }

  /**
   * Get execution IDs holding lock on credential
   */
  getLockHolders(credentialId: string): string[] {
    this.cleanupStaleLocks(credentialId);

    const locks = this.locks.get(credentialId);
    return locks ? Array.from(locks) : [];
  }

  /**
   * Get lock count for credential
   */
  getLockCount(credentialId: string): number {
    return this.getLockHolders(credentialId).length;
  }

  /**
   * Clean up stale locks (older than timeout)
   */
  private cleanupStaleLocks(credentialId: string): void {
    const locks = this.locks.get(credentialId);
    if (!locks) return;

    const now = Date.now();
    for (const executionId of locks) {
      const lockKey = `${credentialId}:${executionId}`;
      const timestamp = this.lockTimestamps.get(lockKey);

      if (timestamp && now - timestamp > this.LOCK_TIMEOUT_MS) {
        console.warn(`Cleaning up stale lock: ${lockKey}`);
        this.releaseLock(credentialId, executionId);
      }
    }
  }

  /**
   * Get all active locks (for debugging)
   */
  getActiveLocks(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [credId, execIds] of this.locks) {
      this.cleanupStaleLocks(credId);
      if (this.locks.has(credId)) {
        result.set(credId, Array.from(this.locks.get(credId)!));
      }
    }
    return result;
  }

  /**
   * Clear all locks (for testing)
   */
  clearAll(): void {
    this.locks.clear();
    this.executionLocks.clear();
    this.lockTimestamps.clear();
  }
}

// Export singleton
export const credentialLockManager = new CredentialLockManager();
