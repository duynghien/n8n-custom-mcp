import { n8nApi } from './n8n-api-service.js';
import { handleApiError } from '../utils/error-handler.js';
import type { N8nCredential } from '../types/n8n-types.js';

/**
 * Service for testing credential validity
 * Creates temporary workflows to validate credential connections
 */
export class CredentialTestService {
  /**
   * Test credential validity by creating and executing a temporary workflow
   * Heavy operation - use sparingly
   *
   * @param credentialId Credential ID to test
   * @returns Test result with validity status and message
   */
  async testCredential(
    credentialId: string,
    credential: N8nCredential
  ): Promise<{
    valid: boolean;
    message: string;
    testedAt: string;
  }> {
    const testWorkflowName = `__test_credential_${credentialId}_${Date.now()}`;

    try {
      // Create minimal test workflow based on credential type
      const testWorkflow = this.createTestWorkflow(testWorkflowName, credential);
      const createdWorkflow = await n8nApi.createWorkflow(testWorkflow);

      // Execute workflow with retry mechanism
      const execution = await this.executeWithRetry(createdWorkflow.id!, 3);

      // Check execution result
      const success = execution.finished && !execution.data?.resultData?.error;

      // Cleanup: delete test workflow
      await n8nApi.deleteWorkflow(createdWorkflow.id!);

      return {
        valid: success,
        message: success
          ? `Successfully connected to ${credential.type}`
          : `Connection failed: ${execution.data?.resultData?.error?.message || 'Unknown error'}`,
        testedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanupTestWorkflow(testWorkflowName);
      throw handleApiError(error, 'Credential test failed');
    }
  }

  /**
   * Execute workflow with exponential backoff retry
   * @private
   */
  private async executeWithRetry(
    workflowId: string,
    maxRetries: number
  ): Promise<any> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const execution = await n8nApi.executeWorkflow(workflowId);

        // Wait a bit for execution to complete
        await this.sleep(2000 * (i + 1));

        // Fetch execution result
        return await n8nApi.getExecution(execution.id);
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await this.sleep(1000 * Math.pow(2, i));
        }
      }
    }

    throw lastError || new Error('Execution failed after retries');
  }

  /**
   * Sleep utility for async delays
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create appropriate test workflow based on credential type
   * Maps credential types to minimal test configurations
   * @private
   */
  private createTestWorkflow(name: string, credential: N8nCredential): any {
    // Map credential types to minimal test workflows
    const testConfigs: Record<string, any> = {
      githubApi: {
        nodeType: 'n8n-nodes-base.github',
        operation: 'user:get',
        parameters: {
          resource: 'user',
          operation: 'get',
        },
      },
      slackApi: {
        nodeType: 'n8n-nodes-base.slack',
        operation: 'user:info',
        parameters: {
          resource: 'user',
          operation: 'info',
          user: '@me',
        },
      },
      googleSheetsOAuth2Api: {
        nodeType: 'n8n-nodes-base.googleSheets',
        operation: 'spreadsheet:get',
        parameters: {
          resource: 'spreadsheet',
          operation: 'get',
        },
      },
      // Default: HTTP Request node for generic testing
    };

    const config = testConfigs[credential.type] || {
      nodeType: 'n8n-nodes-base.httpRequest',
      operation: 'get',
      parameters: {
        method: 'GET',
        url: 'https://httpbin.org/get',
      },
    };

    return {
      name,
      active: false,
      nodes: [
        {
          id: 'test-node',
          name: 'Test Node',
          type: config.nodeType,
          typeVersion: 1,
          position: [250, 300],
          parameters: config.parameters || {},
          credentials: {
            [credential.type]: {
              id: credential.id,
              name: credential.name,
            },
          },
        },
      ],
      connections: {},
    };
  }

  /**
   * Cleanup test workflow if it still exists
   * @private
   */
  private async cleanupTestWorkflow(testWorkflowName: string): Promise<void> {
    try {
      const workflows = await n8nApi.listWorkflows({});
      const testWf = workflows.data.find(w => w.name === testWorkflowName);
      if (testWf) {
        await n8nApi.deleteWorkflow(testWf.id!);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Export singleton instance
export const credentialTestService = new CredentialTestService();
