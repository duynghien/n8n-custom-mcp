import type { N8nWorkflow } from './n8n-types.js';

/**
 * n8n.io template structure
 */
export interface N8nTemplate {
  id: number;
  name: string;
  description: string;
  workflow: N8nWorkflow;
  nodes: number;
  categories: string[];
  createdAt: string;
}

/**
 * Template search result from n8n.io API
 */
export interface TemplateSearchResult {
  templates: Array<{
    id: number;
    name: string;
    description: string;
    nodes: number;
    categories: string[];
  }>;
  total: number;
}

/**
 * Cache entry with TTL
 */
export interface TemplateCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * Options for importing a template
 */
export interface ImportTemplateOptions {
  credentialMapping?: Record<string, string>;
  skipNodeValidation?: boolean;
  importInactive?: boolean;
}

/**
 * Options for exporting workflow as template
 */
export interface ExportWorkflowOptions {
  includeCredentials?: boolean;
  includeExecutionData?: boolean;
  stripIds?: boolean;
}
