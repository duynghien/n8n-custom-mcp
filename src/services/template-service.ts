import axios, { AxiosInstance } from 'axios';
import { n8nApi } from './n8n-api-service.js';
import {
  cleanWorkflowForImport,
  stripCredentialsFromWorkflow,
  stripSensitiveFields,
} from '../utils/workflow-cleaner.js';
import { TemplateCache } from '../utils/template-cache.js';
import {
  applyCredentialMapping,
  checkNodeCompatibility,
} from '../utils/template-import-helpers.js';
import type {
  N8nTemplate,
  TemplateSearchResult,
  ImportTemplateOptions,
  ExportWorkflowOptions,
  N8nWorkflow,
} from '../types/n8n-types.js';

/**
 * Service for managing n8n templates
 * Handles search, import, export with caching
 */
export class TemplateService {
  private templateClient: AxiosInstance;
  private cache: TemplateCache = new TemplateCache(3600); // 1 hour default TTL

  constructor() {
    this.templateClient = axios.create({
      baseURL: 'https://api.n8n.io',
      timeout: 10000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  /**
   * Search templates from n8n.io
   */
  async searchTemplates(
    query: string,
    category?: string
  ): Promise<TemplateSearchResult> {
    const cacheKey = `search:${query}:${category || 'all'}`;

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.templateClient.get('/templates/search', {
        params: { q: query, category },
      });

      const result: TemplateSearchResult = {
        templates: response.data.workflows || [],
        total: response.data.total || 0,
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { templates: [], total: 0 };
      }
      throw new Error(
        `Failed to search templates: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get full template details including workflow JSON
   */
  async getTemplateDetails(id: number): Promise<N8nTemplate> {
    const cacheKey = `template:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.templateClient.get(`/templates/workflows/${id}`);
      const template: N8nTemplate = response.data;

      this.cache.set(cacheKey, template);
      return template;
    } catch (error) {
      throw new Error(`Template ${id} not found or unavailable`);
    }
  }

  /**
   * Import template as new workflow
   */
  async importTemplate(
    id: number,
    options: ImportTemplateOptions = {}
  ): Promise<N8nWorkflow> {
    // 1. Get template
    const template = await this.getTemplateDetails(id);

    // 2. Check node compatibility (unless skipped)
    if (!options.skipNodeValidation) {
      const nodeTypes = await n8nApi.listNodeTypes();
      const validation = await checkNodeCompatibility(template, nodeTypes);
      if (!validation.compatible) {
        throw new Error(
          `Cannot import template: Missing nodes: ${validation.missingNodes.join(', ')}`
        );
      }
    }

    // 3. Clean workflow JSON
    let workflow = cleanWorkflowForImport(template.workflow);

    // 4. Apply credential mapping
    if (options.credentialMapping) {
      workflow = applyCredentialMapping(workflow, options.credentialMapping);
    }

    // 5. Set active status
    workflow.active = options.importInactive === false;

    // 6. Create workflow via n8n API
    const created = await n8nApi.createWorkflow(workflow);

    return created;
  }

  /**
   * Export workflow as template (safe for sharing)
   */
  async exportWorkflow(
    id: string,
    options: ExportWorkflowOptions = {}
  ): Promise<any> {
    // 1. Get workflow
    const workflow = await n8nApi.getWorkflow(id);

    // 2. Strip credentials (default)
    let cleaned = workflow;
    if (options.includeCredentials !== true) {
      cleaned = stripCredentialsFromWorkflow(cleaned);
    }

    // 3. Strip sensitive fields (default)
    if (options.stripIds !== false) {
      cleaned = stripSensitiveFields(cleaned);
    }

    // 4. Re-add execution data if requested (since stripSensitiveFields removes it)
    if (options.includeExecutionData === true) {
      cleaned.staticData = workflow.staticData;
      cleaned.pinData = workflow.pinData;
    }

    return cleaned;
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const templateService = new TemplateService();
