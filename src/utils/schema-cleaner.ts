import type { N8nNodeSchema, INodeProperties } from '../types/n8n-types.js';

export interface ICleanNodeSchema {
  displayName: string;
  name: string;
  description: string;
  properties: ICleanNodeProperties[];
}

export interface ICleanNodeProperties {
  displayName: string;
  name: string;
  type: string;
  default?: any;
  description?: string;
  options?: Array<{
    name: string;
    value: string | number | boolean;
    description?: string;
  }>;
  required?: boolean;
  typeOptions?: {
    [key: string]: any;
  };
}

/**
 * Clean a node schema by removing non-essential fields (UI config, etc.)
 * This reduces token usage while keeping logical parameters intact.
 *
 * @param schema The raw n8n node schema
 * @returns A cleaned version of the schema
 */
export function cleanNodeSchema(schema: N8nNodeSchema): ICleanNodeSchema {
  return {
    displayName: schema.displayName,
    name: schema.name,
    description: schema.description,
    properties: cleanProperties(schema.properties)
  };
}

/**
 * Recursively clean node properties
 */
function cleanProperties(properties: INodeProperties[]): ICleanNodeProperties[] {
  if (!properties || !Array.isArray(properties)) {
    return [];
  }

  return properties.map(prop => {
    // Basic fields we always want to keep
    const cleanProp: ICleanNodeProperties = {
      displayName: prop.displayName,
      name: prop.name,
      type: prop.type,
      default: prop.default,
      description: prop.description,
      required: prop.required,
    };

    // Keep options for dropdowns/multi-selects
    if (prop.options) {
      cleanProp.options = prop.options.map(opt => ({
        name: opt.name,
        value: opt.value,
        description: opt.description
      }));
    }

    // Recursively clean sub-properties (e.g. for 'collection' or 'fixedCollection' types)
    // Note: n8n usually nests properties inside 'options' for fixedCollection or similar structures
    // But the current INodeProperties def we added doesn't explicitly show recursive 'options' structure for fixedCollection
    // Let's check if the property has nested options that are more than just simple values.
    // However, the current INodeProperties.options is simple.
    // If n8n uses 'options' for nested structures (like in fixedCollection), the type might be more complex.
    // For now, based on the plan, we stick to simple cleaning.

    // Keep typeOptions as they often contain logic dependencies (like loadOptionsMethod)
    if (prop.typeOptions) {
      cleanProp.typeOptions = prop.typeOptions;
    }

    return cleanProp;
  });
}
