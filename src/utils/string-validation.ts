/**
 * String validation result
 */
interface StringValidationResult {
  valid: boolean;
  normalizedValue?: string;
  error?: string;
}

/**
 * Validate string field is non-empty after trimming
 */
export function validateNonEmptyString(
  value: any,
  fieldName: string
): StringValidationResult {
  // Type check
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a string, got ${typeof value}`,
    };
  }

  // Trim and check
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: `${fieldName} cannot be empty or whitespace-only`,
    };
  }

  return {
    valid: true,
    normalizedValue: trimmed,
  };
}

/**
 * Validate identifier (alphanumeric, hyphen, underscore)
 */
export function validateIdentifier(
  value: any,
  fieldName: string,
  options: {
    allowEmpty?: boolean;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): StringValidationResult {
  const { allowEmpty = false, maxLength = 255, pattern = /^[a-zA-Z0-9_-]+$/ } = options;

  // Type check
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a string, got ${typeof value}`,
    };
  }

  const trimmed = value.trim();

  // Empty check
  if (trimmed.length === 0) {
    if (allowEmpty) {
      return { valid: true, normalizedValue: '' };
    }
    return {
      valid: false,
      error: `${fieldName} cannot be empty`,
    };
  }

  // Length check
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength}`,
    };
  }

  // Pattern check
  if (!pattern.test(trimmed)) {
    return {
      valid: false,
      error: `${fieldName} contains invalid characters`,
    };
  }

  return {
    valid: true,
    normalizedValue: trimmed,
  };
}

/**
 * Validate node ID format
 * n8n uses UUIDs or custom IDs
 */
export function validateNodeId(value: any): StringValidationResult {
  return validateIdentifier(value, 'Node ID', {
    maxLength: 100,
    // Allow UUIDs and custom alphanumeric IDs
    pattern: /^[a-zA-Z0-9_-]+$/,
  });
}

/**
 * Validate credential type format
 * Must be non-empty and valid n8n credential type name
 */
export function validateCredentialType(value: any): StringValidationResult {
  return validateIdentifier(value, 'Credential type', {
    maxLength: 100,
    // n8n credential types: camelCase or with dots
    pattern: /^[a-zA-Z][a-zA-Z0-9.]*$/,
  });
}

/**
 * Batch validate multiple strings
 */
export function validateStrings(
  fields: Array<{ value: any; name: string; required?: boolean }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (field.required || field.value !== undefined) {
      const result = validateNonEmptyString(field.value, field.name);
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
