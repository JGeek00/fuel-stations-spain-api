/**
 * Validates a session ID header value. Returns the ID if valid, undefined otherwise.
 */
export const parseSessionId = (raw: string | undefined): string | undefined => {
  if (!raw || raw === 'null' || raw === 'undefined') return undefined;
  return raw;
}

/**
 * Parses a comma-separated environment variable into a string array.
 */
export const parseCsvEnv = (value: string | undefined): string[] => {
  if (!value || value.trim() === '') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}