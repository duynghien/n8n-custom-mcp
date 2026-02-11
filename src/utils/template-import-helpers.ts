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
