import { n8nApi } from './n8n-api-service.js';
import { credentialTestService } from './credential-test-service.js';
import { handleApiError } from '../utils/error-handler.js';
import { TemplateCache } from '../utils/template-cache.js';
import { credentialLockManager } from '../utils/credential-lock-manager.js';
import type { N8nCredential, N8nCredentialSchema } from '../types/n8n-types.js';

/**
 * Recursively sanitize object to prevent prototype pollution
 * Removes __proto__, constructor, prototype keys at all levels
 */
function sanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue; // Skip dangerous keys
    }
    sanitized[key] = sanitizeObject(value); // Recursive
  }
  return sanitized;
}

/**
 * Service class for n8n credential management
 * Handles credential CRUD, validation, testing, and usage tracking
 */
export class CredentialService {
  private cache: TemplateCache = new TemplateCache(5); // 5s cache for credentials (sensitive data)
  /**
   * Get schema for credential type
   * @throws McpError if credential type not found
   */
  async getSchema(credentialType: string): Promise<N8nCredentialSchema> {
    try {
      return await n8nApi.getCredentialSchema(credentialType);
    } catch (error) {
      throw handleApiError(error, `Schema not found for ${credentialType}`);
    }
  }

  /**
   * List credentials - HYBRID APPROACH
   * 1. Check cache
   * 2. Parse from workflows (primary)
   * 3. Fallback to psql if available
   * 4. Deduplicate and return
   */
  async listCredentials(type?: string): Promise<N8nCredential[]> {
    const cacheKey = `list:${type || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const credentials = new Map<string, N8nCredential>();

    // Method 1: Parse from workflows
    const credentialsFromWorkflows = await this.listFromWorkflows();
    credentialsFromWorkflows.forEach(cred => {
      credentials.set(cred.id!, cred);
    });

    // Method 2: Fallback to psql (if database accessible)
    try {
      const credentialsFromDb = await this.listFromDatabase();
      credentialsFromDb.forEach(cred => {
        credentials.set(cred.id!, cred);
      });
    } catch (error) {
      // Database not accessible, use workflow data only
      console.warn('Database query failed, using workflow data only');
    }

    // Filter by type if specified
    let result = Array.from(credentials.values());
    if (type) {
      result = result.filter(cred => cred.type === type);
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Parse credentials from all workflows
   * @private
   */
  private async listFromWorkflows(): Promise<N8nCredential[]> {
    const workflows = await n8nApi.listWorkflows({});
    const credentialMap = new Map<string, N8nCredential>();

    for (const workflow of workflows.data) {
      if (!workflow.nodes) continue;

      for (const node of workflow.nodes) {
        if (!node.credentials) continue;

        // Extract credential references
        for (const [credType, credData] of Object.entries(node.credentials)) {
          const credId = (credData as any).id;
          const credName = (credData as any).name;

          if (credId && !credentialMap.has(credId)) {
            credentialMap.set(credId, {
              id: credId,
              name: credName || 'Unknown',
              type: credType,
            });
          }
        }
      }
    }

    return Array.from(credentialMap.values());
  }

  /**
   * Query credentials from PostgreSQL database (fallback)
   * Requires psql command and proper permissions
   * @private
   */
  private async listFromDatabase(): Promise<N8nCredential[]> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const dbHost = process.env.DB_POSTGRESDB_HOST || 'localhost';
    const dbPort = process.env.DB_POSTGRESDB_PORT || '5432';
    const dbName = process.env.DB_POSTGRESDB_DATABASE || 'n8n';
    const dbUser = process.env.DB_POSTGRESDB_USER || 'n8n';
    const dbPassword = process.env.DB_POSTGRESDB_PASSWORD || '';

    // Validate host against whitelist pattern (hostname or IP)
    const validHostPattern = /^[a-zA-Z0-9][-a-zA-Z0-9.]*$/;
    if (!validHostPattern.test(dbHost)) {
      throw new Error('Invalid database host');
    }

    // Validate port is numeric
    if (!/^\d+$/.test(dbPort)) {
      throw new Error('Invalid database port');
    }

    // Validate database name (alphanumeric, underscore, hyphen)
    const validDbNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!validDbNamePattern.test(dbName)) {
      throw new Error('Invalid database name');
    }

    const query = 'SELECT id, name, type FROM credentials_entity;';
    const env = { ...process.env, PGPASSWORD: dbPassword };

    const { stdout } = await execFileAsync(
      'psql',
      ['-h', dbHost, '-p', dbPort, '-U', dbUser, '-d', dbName, '-t', '-A', '-F,', '-c', query],
      { env }
    );

    // Parse CSV output
    const lines = stdout.trim().split('\n').filter(line => line);
    return lines.map(line => {
      const [id, name, type] = line.split(',');
      return { id, name, type };
    });
  }

  /**
   * Validate credential data against schema
   */
  async validateCredentialData(
    type: string,
    data: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[] }> {
    // Null/undefined check for data parameter
    if (data === null || data === undefined) {
      return { valid: false, errors: ['Credential data is required'] };
    }

    const schema = await this.getSchema(type);
    const errors: string[] = [];

    // Protect against prototype pollution in credential data
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of dangerousKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(`Invalid credential data key: ${key}`);
      }
    }

    // Early return if dangerous keys found
    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Check required fields
    for (const prop of schema.properties) {
      if (prop.required && data[prop.name] === undefined) {
        errors.push(`Missing required field: ${prop.name}`);
      }
    }

    // Check field types (basic validation)
    for (const [key, value] of Object.entries(data)) {
      const prop = schema.properties.find(p => p.name === key);
      if (!prop) continue;

      if (prop.type === 'string' && typeof value !== 'string') {
        errors.push(`Field ${key} must be a string`);
      } else if (prop.type === 'number' && typeof value !== 'number') {
        errors.push(`Field ${key} must be a number`);
      } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field ${key} must be a boolean`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create credential with validation
   * Warns if duplicate name exists (n8n allows duplicates)
   */
  async createCredential(credential: N8nCredential): Promise<N8nCredential> {
    // Sanitize credential data before validation
    if (credential.data) {
      const sanitized = Object.create(null);
      for (const [key, value] of Object.entries(credential.data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error(`Invalid credential data key: ${key}`);
        }
        sanitized[key] = value;
      }
      credential.data = sanitized;
    }

    // Validate data against schema
    const validation = await this.validateCredentialData(
      credential.type,
      credential.data || {}
    );

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for duplicate names (warning only)
    const existing = await this.listCredentials();
    const duplicate = existing.find(c => c.name === credential.name);
    if (duplicate) {
      console.warn(
        `Warning: Credential name "${credential.name}" already exists (ID: ${duplicate.id})`
      );
    }

    // Create via API
    const created = await n8nApi.createCredential(credential);
    this.cache.clear();
    return created;
  }

  /**
   * Update existing credential
   */
  async updateCredential(id: string, updates: Partial<N8nCredential>): Promise<N8nCredential> {
    // Sanitize credential data if present in updates
    if (updates.data) {
      const sanitized = Object.create(null);
      for (const [key, value] of Object.entries(updates.data)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error(`Invalid credential data key: ${key}`);
        }
        sanitized[key] = value;
      }
      updates.data = sanitized;
    }

    // Verify credential exists first
    const credentials = await this.listCredentials();
    const exists = credentials.some(c => c.id === id);
    if (!exists) {
      throw new Error(`Credential ${id} not found`);
    }

    const updated = await n8nApi.updateCredential(id, updates);
    this.cache.clear();
    return updated;
  }

  /**
   * Find all workflows using a specific credential
   * Used for safety checks before deletion
   */
  async getCredentialUsage(credentialId: string): Promise<string[]> {
    const workflows = await n8nApi.listWorkflows({});
    const usedBy: string[] = [];

    for (const workflow of workflows.data) {
      if (!workflow.nodes) continue;

      for (const node of workflow.nodes) {
        if (!node.credentials) continue;

        for (const credData of Object.values(node.credentials)) {
          if ((credData as any).id === credentialId) {
            usedBy.push(workflow.id!);
            break;
          }
        }
      }
    }

    return usedBy;
  }

  /**
   * Delete credential with safety checks
   * @param id Credential ID
   * @param force Skip in-use check
   */
  async deleteCredential(id: string, force: boolean = false): Promise<void> {
    // Check if credential is locked by active execution
    if (!force && credentialLockManager.isLocked(id)) {
      const holders = credentialLockManager.getLockHolders(id);
      throw new Error(
        `Credential is locked by ${holders.length} active execution(s): ${holders.join(', ')}. ` +
        `Use force=true to delete anyway (may cause execution failures).`
      );
    }

    if (!force) {
      const usedBy = await this.getCredentialUsage(id);
      if (usedBy.length > 0) {
        throw new Error(
          `Credential is used by ${usedBy.length} workflow(s): ${usedBy.join(', ')}. ` +
          `Use force=true to delete anyway.`
        );
      }
    }

    await n8nApi.deleteCredential(id);
    this.cache.clear();
  }

  /**
   * Test credential validity
   * Delegates to credential-test-service
   */
  async testCredential(credentialId: string): Promise<{
    valid: boolean;
    message: string;
    testedAt: string;
  }> {
    // Get credential info to pass to test service
    const credentials = await this.listCredentials();
    const credential = credentials.find(c => c.id === credentialId);

    if (!credential) {
      throw new Error(`Credential ${credentialId} not found`);
    }

    return await credentialTestService.testCredential(credentialId, credential);
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const credentialService = new CredentialService();
