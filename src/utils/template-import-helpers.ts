import { credentialService } from '../services/credential-service.js';

/**
 * Validation result for credential mapping
 */
export interface CredentialMappingValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate credential mapping before applying
 * Checks that credential IDs exist and types match node requirements
 */
export async function validateCredentialMapping(
  workflow: any,
  mapping: Record<string, string>
): Promise<CredentialMappingValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get available credentials for validation
  let availableCredentials: Array<{ id: string; type: string }> = [];
  try {
    const creds = await credentialService.listCredentials();
    // Filter out credentials without IDs and map to required type
    availableCredentials = creds
      .filter((c): c is typeof c & { id: string } => c.id !== undefined)
      .map(c => ({ id: c.id, type: c.type }));
  } catch (error) {
    warnings.push('Could not fetch available credentials for validation');
  }

  // Build a map of available credentials by ID
  const credMap = new Map(availableCredentials.map(c => [c.id, c.type]));

  // Validate each node's credential mapping
  for (const node of workflow.nodes || []) {
    if (!node.credentials) continue;

    for (const [credType, credData] of Object.entries(node.credentials)) {
      const templateCredId = (credData as any).id;
      const mappedCredId = mapping[templateCredId];

      if (!mappedCredId) {
        // No mapping provided for this credential
        warnings.push(
          `Node "${node.name}" has credential "${credType}" with no mapping provided`
        );
        continue;
      }

      // Check if mapped credential ID exists
      const actualCredType = credMap.get(mappedCredId);
      if (!actualCredType) {
        errors.push(
          `Mapped credential ID "${mappedCredId}" for node "${node.name}" does not exist`
        );
        continue;
      }

      // Check if credential type matches node requirement
      if (actualCredType !== credType) {
        errors.push(
          `Credential type mismatch for node "${node.name}": ` +
          `node requires "${credType}" but mapped credential "${mappedCredId}" is "${actualCredType}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Apply credential mapping to workflow nodes
 */
export function applyCredentialMapping(
  workflow: any,
  mapping: Record<string, string>
): any {
  return {
    ...workflow,
    nodes: workflow.nodes?.map((node: any) => {
      if (!node.credentials) return node;

      const mappedCreds: any = {};
      for (const [credType, credData] of Object.entries(node.credentials)) {
        const templateCredId = (credData as any).id;
        const mappedCredId = mapping[templateCredId];

        if (mappedCredId) {
          mappedCreds[credType] = { id: mappedCredId };
        } else {
          mappedCreds[credType] = { id: null };
        }
      }

      return { ...node, credentials: mappedCreds };
    }) || [],
  };
}

/**
 * Check if template nodes are compatible with current n8n instance
 */
export async function checkNodeCompatibility(
  template: any,
  availableNodeTypes: any[]
): Promise<{
  compatible: boolean;
  missingNodes: string[];
  warnings: string[];
}> {
  // Null safety check
  if (!template || !template.workflow || !template.workflow.nodes) {
    return {
      compatible: false,
      missingNodes: [],
      warnings: ['Template workflow is missing or invalid'],
    };
  }

  const availableTypes = new Set(availableNodeTypes.map((t: any) => t.name));

  const templateNodeTypes = new Set(
    template.workflow.nodes.map((n: any) => n.type)
  );

  const missingNodes = Array.from(templateNodeTypes).filter(
    (type): type is string => typeof type === 'string' && !availableTypes.has(type)
  );

  const warnings: string[] = [];

  // Check for community nodes
  for (const nodeType of templateNodeTypes) {
    if (typeof nodeType === 'string' && nodeType.startsWith('@')) {
      warnings.push(
        `Community node detected: ${nodeType} - may require manual installation`
      );
    }
  }

  return {
    compatible: missingNodes.length === 0,
    missingNodes,
    warnings,
  };
}
