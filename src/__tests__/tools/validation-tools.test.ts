import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleValidationTool } from '../../tools/validation-tools.js';
import { validationService } from '../../services/validation-service.js';

// Mock validationService
vi.mock('../../services/validation-service.js', () => ({
  validationService: {
    validateWorkflowStructure: vi.fn(),
  },
}));

describe('Validation Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleValidationTool()', () => {
    it('should call validateWorkflowStructure with correct arguments', async () => {
      const mockWorkflow = { name: 'Test', nodes: [] };
      const mockResult = { valid: true, errors: [], warnings: [] };
      vi.mocked(validationService.validateWorkflowStructure).mockResolvedValue(mockResult);

      const result = await handleValidationTool('validate_workflow_structure', {
        workflow: mockWorkflow,
      });

      expect(validationService.validateWorkflowStructure).toHaveBeenCalledWith(mockWorkflow);
      expect(result).toEqual(mockResult);
    });

    it('should throw error for missing workflow argument', async () => {
      await expect(handleValidationTool('validate_workflow_structure', {}))
        .rejects.toThrow('Missing required parameters: workflow');
    });

    it('should throw error for unknown tool', async () => {
      await expect(handleValidationTool('unknown_tool', {}))
        .rejects.toThrow('Unknown validation tool: unknown_tool');
    });
  });
});
