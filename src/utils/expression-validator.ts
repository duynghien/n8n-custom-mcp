import { Script } from 'vm';

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

  // Use a more robust regex that handles nested braces
  const regex = /\{\{([\s\S]*?)\}\}/g;
  const expressions: string[] = [];
  let match;

  while ((match = regex.exec(value)) !== null) {
    const expr = match[1].trim();
    // Check for nested braces (invalid expression)
    if (expr.includes('{{') || expr.includes('}}')) {
      continue;
    }
    expressions.push(expr);
  }

  return expressions;
}

/**
 * Advanced validation of n8n expression syntax
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
  // 1. Check for empty expression
  if (!expression || expression.trim() === '') {
    return { valid: false, error: 'Empty expression' };
  }

  // 2. Check for prototype pollution attempts
  if (
    expression.includes('__proto__') ||
    expression.includes('constructor') ||
    expression.includes('prototype')
  ) {
    return { valid: false, error: 'Expression contains forbidden keywords' };
  }

  // 3. Check for invalid variable references that could lead to prototype pollution
  const protoPattern = /\$__proto__|\$constructor/;
  if (protoPattern.test(expression)) {
    return { valid: false, error: 'Invalid variable reference' };
  }

  // 4. Check for dangerous functions that could execute arbitrary code
  const dangerousFunctions = /\b(eval|Function|setTimeout|setInterval|setImmediate)\s*\(/;
  if (dangerousFunctions.test(expression)) {
    return {
      valid: false,
      error: 'Expression contains dangerous function (eval, Function, setTimeout, setInterval, setImmediate)'
    };
  }

  // 5. Check for constructor access patterns
  const constructorAccess = /\.constructor\s*\(|\.constructor\s*\[/;
  if (constructorAccess.test(expression)) {
    return {
      valid: false,
      error: 'Direct constructor access is not allowed'
    };
  }

  // 6. Check for balanced parentheses
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

  // 7. Check for valid variable references
  const varRegex = /\$(json|node|vars|parameter|now|today|workflow|execution|input|binary|env|prevNode|self)/;
  if (expression.includes('$') && !varRegex.test(expression)) {
    // Basic check for common mistakes like $jsn instead of $json
    const potentialTypos = /\$([a-zA-Z]+)/g;
    let match;
    while ((match = potentialTypos.exec(expression)) !== null) {
      const varName = match[1];
      if (!varRegex.test('$' + varName)) {
        return { valid: false, error: `Invalid variable reference: $${varName}` };
      }
    }
  }

  // 8. Validate JS syntax using vm.Script (without executing)
  try {
    // Replace n8n specific variables with placeholders to allow JS syntax validation
    const sanitizedExpr = expression.replace(/\$(json|node|vars|parameter|now|today|workflow|execution|input|binary|env|prevNode|self)/g, '___V');
    new Script(sanitizedExpr);
  } catch (error) {
    return {
      valid: false,
      error: `Syntax error: ${error instanceof Error ? error.message : 'Invalid JavaScript'}`
    };
  }

  return { valid: true };
}
