// n8n Workflow types
export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes?: N8nNode[];
  connections?: Record<string, any>;
  active?: boolean;
  settings?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  staticData?: any;
  pinData?: any;
  versionId?: string;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  disabled?: boolean;
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  data?: {
    resultData?: {
      runData?: Record<string, any>;
      error?: {
        message: string;
        node?: string;
      };
    };
  };
}

export interface N8nCredential {
  id?: string;
  name: string;
  type: string;
  data?: Record<string, any>;
  nodesAccess?: Array<{ nodeType: string }>;
}

export interface N8nCredentialSchema {
  type: string;
  displayName: string;
  properties: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

// Connection types
export interface N8nConnection {
  node: string;
  type: string;
  index: number;
}

export interface N8nConnections {
  [sourceNodeId: string]: {
    [outputType: string]: N8nConnection[][][];
  };
}

// Re-export template types
export type {
  N8nTemplate,
  TemplateSearchResult,
  TemplateCacheEntry,
  ImportTemplateOptions,
  ExportWorkflowOptions,
} from './template-types.js';
