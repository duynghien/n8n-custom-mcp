import { describe, it, expect } from 'vitest';
import { cleanNodeSchema } from './schema-cleaner.js';
import type { N8nNodeSchema } from '../types/n8n-types.js';

describe('cleanNodeSchema', () => {
  it('should clean simple schema fields', () => {
    const rawSchema: N8nNodeSchema = {
      displayName: 'Test Node',
      name: 'testNode',
      icon: 'fa:test',
      group: ['test'],
      version: 1,
      description: 'A test node',
      defaults: { name: 'Test Node' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Property 1',
          name: 'prop1',
          type: 'string',
          default: 'default',
          description: 'Description 1',
          required: true,
          displayOptions: {
            show: {
              resource: ['test']
            }
          }
        }
      ]
    };

    const cleaned = cleanNodeSchema(rawSchema);

    expect(cleaned).toEqual({
      displayName: 'Test Node',
      name: 'testNode',
      description: 'A test node',
      properties: [
        {
          displayName: 'Property 1',
          name: 'prop1',
          type: 'string',
          default: 'default',
          description: 'Description 1',
          required: true
        }
      ]
    });
  });

  it('should keep options for dropdowns', () => {
    const rawSchema: N8nNodeSchema = {
      displayName: 'Test Node',
      name: 'testNode',
      icon: 'fa:test',
      group: ['test'],
      version: 1,
      description: 'A test node',
      defaults: { name: 'Test Node' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Select Prop',
          name: 'selectProp',
          type: 'options',
          options: [
            { name: 'Option 1', value: 'opt1', description: 'Desc 1' },
            { name: 'Option 2', value: 'opt2' }
          ]
        }
      ]
    };

    const cleaned = cleanNodeSchema(rawSchema);

    expect(cleaned.properties[0].options).toHaveLength(2);
    expect(cleaned.properties[0].options?.[0]).toEqual({
      name: 'Option 1',
      value: 'opt1',
      description: 'Desc 1'
    });
  });

  it('should keep typeOptions', () => {
    const rawSchema: N8nNodeSchema = {
      displayName: 'Test Node',
      name: 'testNode',
      icon: 'fa:test',
      group: ['test'],
      version: 1,
      description: 'A test node',
      defaults: { name: 'Test Node' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Type Opts Prop',
          name: 'typeOptsProp',
          type: 'string',
          typeOptions: {
            loadOptionsMethod: 'getBuckets'
          }
        }
      ]
    };

    const cleaned = cleanNodeSchema(rawSchema);

    expect(cleaned.properties[0].typeOptions).toEqual({
      loadOptionsMethod: 'getBuckets'
    });
  });

  it('should handle empty properties', () => {
    const rawSchema: N8nNodeSchema = {
      displayName: 'Test Node',
      name: 'testNode',
      icon: 'fa:test',
      group: ['test'],
      version: 1,
      description: 'A test node',
      defaults: { name: 'Test Node' },
      inputs: ['main'],
      outputs: ['main'],
      properties: []
    };

    const cleaned = cleanNodeSchema(rawSchema);
    expect(cleaned.properties).toEqual([]);
  });
});
