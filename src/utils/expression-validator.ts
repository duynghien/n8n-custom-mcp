/**
 * Extract all {{ }} expressions from a value
 *
 * @param value - The value to extract expressions from
 * @returns Array of extracted expression strings (without {{ }})
 *
 * @example
 * extractExpressions("Hello {{ $json.name }}") // returns ["$json.name"]
 * extractExpressions({ key: "{{ $node.value }}" }) // returns ["$node.value"]
 */
export function extractExpressions(value: any): string[] {
  if (typeof value !== 'string') return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const expressions: string[] = [];
  let match;

  while ((match = regex.exec(value)) !== null) {
    expressions.push(match[1].trim());
  }

  return expressions;
}

/**
 * Basic validation of n8n expression syntax
 *
 * @param expression - The expression string to validate (without {{ }})
 * @returns Validation result with error message if invalid
 *
 * @example
 * validateExpression("$json.name") // { valid: true }
 * validateExpression("(1 + 2") // { valid: false, error: "Unbalanced parentheses" }
 */
export function validateExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of expression) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'Unbalanced parentheses' };
  }

  // Check for valid variable references
  const varRegex = /\$(json|node|vars|parameter|now|today|workflow|execution|input|binary)/;
  if (expression.includes('$') && !varRegex.test(expression)) {
    return { valid: false, error: 'Invalid variable reference' };
  }

  return { valid: true };
}
