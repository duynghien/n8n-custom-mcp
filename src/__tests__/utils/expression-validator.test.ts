import { describe, it, expect } from 'vitest';
import { extractExpressions, validateExpression } from '../../utils/expression-validator.js';

describe('Expression Validator', () => {
  describe('extractExpressions()', () => {
    it('should extract single expression from string', () => {
      const result = extractExpressions('Hello {{ $json.name }}');
      expect(result).toEqual(['$json.name']);
    });

    it('should extract multiple expressions from string', () => {
      const result = extractExpressions('{{ $json.first }} {{ $json.last }}');
      expect(result).toEqual(['$json.first', '$json.last']);
    });

    it('should return empty array if no expressions found', () => {
      const result = extractExpressions('No expressions here');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-string input', () => {
      expect(extractExpressions(null)).toEqual([]);
      expect(extractExpressions(undefined)).toEqual([]);
      expect(extractExpressions(123)).toEqual([]);
      expect(extractExpressions({})).toEqual([]);
    });

    it('should trim extracted expressions', () => {
      const result = extractExpressions('{{  $json.name  }}');
      expect(result).toEqual(['$json.name']);
    });

    it('should handle complex expressions', () => {
      const result = extractExpressions('Value is {{ $json.amount > 10 ? \"high\" : \"low\" }}');
      expect(result).toEqual(['$json.amount > 10 ? \"high\" : \"low\"']);
    });
  });

  describe('validateExpression()', () => {
    it('should validate balanced parentheses', () => {
      expect(validateExpression('(1 + 2) * 3').valid).toBe(true);
      expect(validateExpression('((1 + 2))').valid).toBe(true);
    });

    it('should fail on unbalanced parentheses', () => {
      const result1 = validateExpression('(1 + 2');
      expect(result1.valid).toBe(false);
      expect(result1.error).toBe('Unbalanced parentheses');

      const result2 = validateExpression('1 + 2)');
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('Unbalanced parentheses');

      const result3 = validateExpression(')(');
      expect(result3.valid).toBe(false);
      expect(result3.error).toBe('Unbalanced parentheses');
    });

    it('should validate common n8n variables', () => {
      const variables = [
        '$json', '$node', '$vars', '$parameter', '$now',
        '$today', '$workflow', '$execution', '$input', '$binary'
      ];

      for (const v of variables) {
        expect(validateExpression(`${v}.property`).valid).toBe(true);
      }
    });

    it('should fail on invalid variable references', () => {
      const result = validateExpression('$invalid.property');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid variable reference: $invalid');
    });

    it('should allow expressions without variables', () => {
      expect(validateExpression('1 + 1').valid).toBe(true);
      expect(validateExpression('\"hello\".toUpperCase()').valid).toBe(true);
    });

    it('should handle nested expressions in validation (as plain string)', () => {
      // Expression validator expects string without {{ }}
      expect(validateExpression('Math.floor(1.5)').valid).toBe(true);
    });
  });
});
