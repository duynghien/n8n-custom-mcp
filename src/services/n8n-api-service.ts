import { n8nClient, webhookClient } from '../config/env.js';
import { handleApiError } from '../utils/error-handler.js';
import type {
  N8nWorkflow,
  N8nExecution,
  N8nCredential,
  N8nCredentialSchema,
  N8nNodeSchema
} from '../types/n8n-types.js';

/**
 * Service class wrapping n8n REST API v1
 * Handles all HTTP communication with n8n instance
 */
export class N8nApiService {
  private nodeSchemaCache = new Map<string, N8nNodeSchema>();
  private readonly MAX_CACHE_SIZE = 100;

  private validateWorkflowId(id: string): void {
    if (!id || id.trim() === '') {
      throw new Error('Workflow ID is required and cannot be empty');
    }
  }

  private validateWebhookPath(path: string): void {
    if (path.includes('..')) {
      throw new Error('Webhook path cannot contain ".."');
    }
    if (path.startsWith('/')) {
      throw new Error('Webhook path cannot start with "/"');
    }
  }

  private setCacheEntry(key: string, value: N8nNodeSchema): void {
    if (this.nodeSchemaCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.nodeSchemaCache.keys().next().value;
      if (firstKey !== undefined) {
        this.nodeSchemaCache.delete(firstKey);
      }
    }
    this.nodeSchemaCache.set(key, value);
  }

  // ===== WORKFLOW OPERATIONS =====

  async listWorkflows(params?: {
    active?: boolean;
    limit?: number;
    tags?: string;
  }): Promise<{ data: N8nWorkflow[] }> {
    try {
      const response = await n8nClient.get('/workflows', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to list workflows');
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    this.validateWorkflowId(id);
    try {
      const response = await n8nClient.get(`/workflows/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to get workflow ${id}`);
    }
  }

  async createWorkflow(workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response = await n8nClient.post('/workflows', workflow);
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to create workflow');
    }
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    this.validateWorkflowId(id);
    try {
      const response = await n8nClient.put(`/workflows/${id}`, workflow);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to update workflow ${id}`);
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.validateWorkflowId(id);
    try {
      await n8nClient.delete(`/workflows/${id}`);
    } catch (error) {
      throw handleApiError(error, `Failed to delete workflow ${id}`);
    }
  }

  async activateWorkflow(id: string, active: boolean): Promise<N8nWorkflow> {
    this.validateWorkflowId(id);
    try {
      const endpoint = active ? 'activate' : 'deactivate';
      const response = await n8nClient.post(`/workflows/${id}/${endpoint}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to ${active ? 'activate' : 'deactivate'} workflow ${id}`);
    }
  }

  // ===== EXECUTION OPERATIONS =====

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
    includeData?: boolean;
  }): Promise<{ data: N8nExecution[] }> {
    try {
      const response = await n8nClient.get('/executions', { params });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to list executions');
    }
  }

  async getExecution(id: string): Promise<N8nExecution> {
    try {
      const response = await n8nClient.get(`/executions/${id}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to get execution ${id}`);
    }
  }

  async executeWorkflow(id: string): Promise<N8nExecution> {
    try {
      const response = await n8nClient.post(`/workflows/${id}/execute`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to execute workflow ${id}`);
    }
  }

  // ===== WEBHOOK OPERATIONS =====

  async triggerWebhook(params: {
    path: string;
    method: string;
    body?: any;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    testMode?: boolean;
  }): Promise<any> {
    this.validateWebhookPath(params.path);
    try {
      const encodedPath = encodeURIComponent(params.path);
      const endpoint = params.testMode
        ? `/webhook-test/${encodedPath}`
        : `/webhook/${encodedPath}`;

      const response = await webhookClient.request({
        method: params.method,
        url: endpoint,
        data: params.body,
        headers: params.headers,
        params: params.queryParams,
        validateStatus: () => true, // Don't throw on any status
      });

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      };
    } catch (error) {
      throw handleApiError(error, 'Failed to trigger webhook');
    }
  }

  // ===== NODE TYPES =====

  async listNodeTypes(): Promise<any[]> {
    try {
      const response = await n8nClient.get('/node-types');
      return response.data.data || response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to list node types');
    }
  }

  async getNodeSchema(nodeName: string): Promise<N8nNodeSchema> {
    // Check cache first
    if (this.nodeSchemaCache.has(nodeName)) {
      return this.nodeSchemaCache.get(nodeName)!;
    }

    try {
      const response = await n8nClient.get(`/node-types/${nodeName}`);
      let schema = response.data;

      // Handle potentially wrapped response (n8n API structure varies)
      if (schema.data) {
        schema = schema.data;
      }

      // If multiple versions are returned (legacy/new structure handling)
      // We want to ensure we get the latest version if it's an array or a map
      // But typically /node-types/:name returns the specific node definition.
      // If the node has versions, n8n might return the default one or a list.
      // Assuming for now it returns a single INodeTypeDescription compatible object.
      // If it returns an array of versions, we'll need to pick the highest one.

      if (Array.isArray(schema)) {
         // Sort by version number (descending) and pick the first one
         schema.sort((a: any, b: any) => {
             const vA = typeof a.version === 'number' ? a.version : (Array.isArray(a.version) ? Math.max(...a.version) : 0);
             const vB = typeof b.version === 'number' ? b.version : (Array.isArray(b.version) ? Math.max(...b.version) : 0);
             return vB - vA;
         });
         schema = schema[0];
      }

      // Store in cache with size limit
      this.setCacheEntry(nodeName, schema);
      return schema;
    } catch (error) {
      throw handleApiError(error, `Failed to get schema for node ${nodeName}`);
    }
  }

  // ===== CREDENTIALS (Phase 1 will extend) =====

  async getCredentialSchema(credentialType: string): Promise<N8nCredentialSchema> {
    try {
      const response = await n8nClient.get(`/credentials/schema/${credentialType}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to get schema for ${credentialType}`);
    }
  }

  async createCredential(credential: N8nCredential): Promise<N8nCredential> {
    try {
      const response = await n8nClient.post('/credentials', credential);
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'Failed to create credential');
    }
  }

  async updateCredential(id: string, credential: Partial<N8nCredential>): Promise<N8nCredential> {
    try {
      const response = await n8nClient.put(`/credentials/${id}`, credential);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `Failed to update credential ${id}`);
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      await n8nClient.delete(`/credentials/${id}`);
    } catch (error) {
      throw handleApiError(error, `Failed to delete credential ${id}`);
    }
  }
}

// Export singleton instance
export const n8nApi = new N8nApiService();
