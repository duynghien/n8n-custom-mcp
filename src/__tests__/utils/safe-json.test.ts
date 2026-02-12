import { describe, it, expect } from 'vitest';
import { safeStringify, safeParse, hasCircularReference } from '../../utils/safe-json.js';

describe('safeStringify', () => {
  it('handles circular references', () => {
    const obj: any = { a: 1 };
    obj.self = obj;

    const result = safeStringify(obj);
    expect(result).toContain('[Circular]');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('handles BigInt values', () => {
    const obj = { id: BigInt('9007199254740993') };
    const result = safeStringify(obj);
    expect(result).toContain('9007199254740993n');
  });

  it('handles Symbol values', () => {
    const obj = { type: Symbol('workflow') };
    const result = safeStringify(obj);
    expect(result).toContain('[Symbol: workflow]');
  });

  it('handles nested circular references', () => {
    const a: any = { name: 'a' };
    const b: any = { name: 'b', ref: a };
    a.ref = b;

    const result = safeStringify(a);
    expect(result).toContain('[Circular]');
  });

  it('preserves normal objects', () => {
    const obj = { name: 'test', nodes: [{ id: '1' }] };
    const result = safeStringify(obj);
    expect(JSON.parse(result)).toEqual(obj);
  });

  it('handles unnamed symbols', () => {
    const obj = { type: Symbol() };
    const result = safeStringify(obj);
    expect(result).toContain('[Symbol: unnamed]');
  });
});

describe('hasCircularReference', () => {
  it('returns true for circular object', () => {
    const obj: any = {};
    obj.self = obj;
    expect(hasCircularReference(obj)).toBe(true);
  });

  it('returns false for normal object', () => {
    const obj = { a: { b: { c: 1 } } };
    expect(hasCircularReference(obj)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(hasCircularReference(null)).toBe(false);
    expect(hasCircularReference(undefined)).toBe(false);
    expect(hasCircularReference(123)).toBe(false);
    expect(hasCircularReference('string')).toBe(false);
  });
});

describe('safeParse', () => {
  it('revives BigInt strings', () => {
    const json = '{"id":"9007199254740993n"}';
    const result = safeParse(json);
    expect(result.id).toBe(BigInt('9007199254740993'));
  });

  it('preserves normal values', () => {
    const json = '{"name":"test","count":42}';
    const result = safeParse(json);
    expect(result).toEqual({ name: 'test', count: 42 });
  });
});
