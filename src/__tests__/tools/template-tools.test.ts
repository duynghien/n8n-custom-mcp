import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env config before other imports
vi.mock('../../config/env.js', () => ({
  N8N_HOST: 'http://localhost:5678',
  N8N_API_KEY: 'test-key',
  n8nClient: {},
  webhookClient: {},
}));

import { handleTemplateTool } from '../../tools/template-tools.js';
import { templateService } from '../../services/template-service.js';

// Mock template service
vi.mock('../../services/template-service.js');

describe('Template Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search_templates', () => {
    it('should call templateService.searchTemplates', async () => {
      vi.mocked(templateService.searchTemplates).mockResolvedValue({
        templates: [{ id: 1, name: 'Test' } as any],
        total: 1,
      });

      const result = await handleTemplateTool('search_templates', { query: 'test', category: 'Dev' });

      expect(templateService.searchTemplates).toHaveBeenCalledWith('test', 'Dev');
      expect(result.total).toBe(1);
    });

    it('should throw error for missing query', async () => {
      await expect(handleTemplateTool('search_templates', {})).rejects.toThrow(
        /Missing required parameters: query/
      );
    });
  });

  describe('get_template_details', () => {
    it('should call templateService.getTemplateDetails', async () => {
      const mockTemplate = { id: 123, workflow: {} };
      vi.mocked(templateService.getTemplateDetails).mockResolvedValue(mockTemplate as any);

      const result = await handleTemplateTool('get_template_details', { id: 123 });

      expect(templateService.getTemplateDetails).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockTemplate);
    });

    it('should throw error for missing id', async () => {
      await expect(handleTemplateTool('get_template_details', {})).rejects.toThrow(
        /Missing required parameters: id/
      );
    });
  });

  describe('import_template', () => {
    it('should call templateService.importTemplate with correct options', async () => {
      vi.mocked(templateService.importTemplate).mockResolvedValue({ id: 'new-wf' } as any);

      await handleTemplateTool('import_template', {
        templateId: 456,
        credentialMapping: { old: 'new' },
        importInactive: false
      });

      expect(templateService.importTemplate).toHaveBeenCalledWith(456, {
        credentialMapping: { old: 'new' },
        skipNodeValidation: undefined,
        importInactive: false
      });
    });

    it('should default importInactive to true', async () => {
      await handleTemplateTool('import_template', { templateId: 456 });
      expect(templateService.importTemplate).toHaveBeenCalledWith(456, {
        credentialMapping: undefined,
        skipNodeValidation: undefined,
        importInactive: true
      });
    });

    it('should throw error for missing templateId', async () => {
      await expect(handleTemplateTool('import_template', {})).rejects.toThrow(
        /Missing required parameters: templateId/
      );
    });
  });

  describe('export_workflow_as_template', () => {
    it('should call templateService.exportWorkflow with correct security defaults', async () => {
      vi.mocked(templateService.exportWorkflow).mockResolvedValue({ nodes: [] });

      await handleTemplateTool('export_workflow_as_template', {
        workflowId: 'wf-123'
      });

      expect(templateService.exportWorkflow).toHaveBeenCalledWith('wf-123', {
        includeCredentials: false,
        stripIds: true
      });
    });

    it('should allow overriding security defaults', async () => {
      await handleTemplateTool('export_workflow_as_template', {
        workflowId: 'wf-123',
        includeCredentials: true,
        stripIds: false
      });

      expect(templateService.exportWorkflow).toHaveBeenCalledWith('wf-123', {
        includeCredentials: true,
        stripIds: false
      });
    });

    it('should throw error for missing workflowId', async () => {
      await expect(handleTemplateTool('export_workflow_as_template', {})).rejects.toThrow(
        /Missing required parameters: workflowId/
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown tool', async () => {
      await expect(handleTemplateTool('unknown_tool', {})).rejects.toThrow(
        'Unknown template tool: unknown_tool'
      );
    });
  });
});
