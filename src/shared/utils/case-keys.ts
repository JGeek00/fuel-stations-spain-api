export const snakeToCamel = (s: string): string =>
  s.replace(/_([a-z0-9])/g, (_m, p1) => p1.toUpperCase());

export const camelToSnake = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1_$2')
    .toLowerCase();

function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

export function keysToCamel<T = any>(input: T): any {
  if (Array.isArray(input)) return input.map((i) => keysToCamel(i));
  if (!isPlainObject(input)) return input;

  const obj = input as Record<string, any>;
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = snakeToCamel(key);
    out[newKey] = keysToCamel(value);
  }
  return out;
}

export function keysToSnake<T = any>(input: T): any {
  if (Array.isArray(input)) return input.map((i) => keysToSnake(i));
  if (!isPlainObject(input)) return input;

  const obj = input as Record<string, any>;
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = camelToSnake(key);
    out[newKey] = keysToSnake(value);
  }
  return out;
}
