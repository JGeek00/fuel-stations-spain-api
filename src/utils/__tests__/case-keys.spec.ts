import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake, keysToCamel, keysToSnake } from '../case-keys';

describe('snakeToCamel', () => {
  it('converts a simple snake_case string', () => {
    expect(snakeToCamel('hello_world')).toBe('helloWorld');
  });

  it('converts a string with multiple underscores', () => {
    expect(snakeToCamel('hello_world_foo_bar')).toBe('helloWorldFooBar');
  });

  it('leaves an already camelCase string unchanged', () => {
    expect(snakeToCamel('helloWorld')).toBe('helloWorld');
  });

  it('leaves a single word unchanged', () => {
    expect(snakeToCamel('hello')).toBe('hello');
  });

  it('handles snake_case with numbers', () => {
    expect(snakeToCamel('foo_123_bar')).toBe('foo123Bar');
  });
});

describe('camelToSnake', () => {
  it('converts a simple camelCase string', () => {
    expect(camelToSnake('helloWorld')).toBe('hello_world');
  });

  it('converts a string with multiple camelCase words', () => {
    expect(camelToSnake('helloWorldFooBar')).toBe('hello_world_foo_bar');
  });

  it('leaves an already snake_case string unchanged', () => {
    expect(camelToSnake('hello_world')).toBe('hello_world');
  });

  it('leaves a single word unchanged', () => {
    expect(camelToSnake('hello')).toBe('hello');
  });

  it('handles camelCase with numbers', () => {
    expect(camelToSnake('foo123Bar')).toBe('foo123_bar');
  });
});

describe('keysToCamel', () => {
  it('converts keys of a flat object', () => {
    const input = { hello_world: 'a', foo_bar: 'b' };
    const result = keysToCamel(input);

    expect(result).toEqual({ helloWorld: 'a', fooBar: 'b' });
  });

  it('converts keys of a nested object recursively', () => {
    const input = {
      outer_key: { inner_key: 'value', another_key: 42 },
    };
    const result = keysToCamel(input);

    expect(result).toEqual({
      outerKey: { innerKey: 'value', anotherKey: 42 },
    });
  });

  it('converts keys of objects inside arrays', () => {
    const input = [{ item_id: 1 }, { item_id: 2 }];
    const result = keysToCamel(input);

    expect(result).toEqual([{ itemId: 1 }, { itemId: 2 }]);
  });

  it('returns primitives unchanged', () => {
    expect(keysToCamel('string')).toBe('string');
    expect(keysToCamel(42)).toBe(42);
    expect(keysToCamel(true)).toBe(true);
    expect(keysToCamel(null)).toBe(null);
    expect(keysToCamel(undefined)).toBe(undefined);
  });

  it('returns empty object unchanged', () => {
    expect(keysToCamel({})).toEqual({});
  });
});

describe('keysToSnake', () => {
  it('converts keys of a flat object', () => {
    const input = { helloWorld: 'a', fooBar: 'b' };
    const result = keysToSnake(input);

    expect(result).toEqual({ hello_world: 'a', foo_bar: 'b' });
  });

  it('converts keys of a nested object recursively', () => {
    const input = {
      outerKey: { innerKey: 'value', anotherKey: 42 },
    };
    const result = keysToSnake(input);

    expect(result).toEqual({
      outer_key: { inner_key: 'value', another_key: 42 },
    });
  });

  it('converts keys of objects inside arrays', () => {
    const input = [{ itemId: 1 }, { itemId: 2 }];
    const result = keysToSnake(input);

    expect(result).toEqual([{ item_id: 1 }, { item_id: 2 }]);
  });

  it('returns primitives unchanged', () => {
    expect(keysToSnake('string')).toBe('string');
    expect(keysToSnake(42)).toBe(42);
    expect(keysToSnake(true)).toBe(true);
    expect(keysToSnake(null)).toBe(null);
    expect(keysToSnake(undefined)).toBe(undefined);
  });

  it('returns empty object unchanged', () => {
    expect(keysToSnake({})).toEqual({});
  });
});

describe('snakeToCamel / camelToSnake roundtrip', () => {
  it('roundtrip: snake -> camel -> snake', () => {
    const original = 'hello_world_foo_bar';
    const camel = snakeToCamel(original);
    const back = camelToSnake(camel);

    expect(back).toBe(original);
  });

  it('roundtrip: camel -> snake -> camel', () => {
    const original = 'helloWorldFooBar';
    const snake = camelToSnake(original);
    const back = snakeToCamel(snake);

    expect(back).toBe(original);
  });
});
