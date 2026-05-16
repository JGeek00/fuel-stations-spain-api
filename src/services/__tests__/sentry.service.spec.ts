import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSentryInit = vi.fn();
const mockNodeProfilingIntegration = vi.fn(() => ({ name: 'ProfilingIntegration', setupOnce: vi.fn() }));

vi.mock('@sentry/node', () => ({
  init: mockSentryInit,
  captureException: vi.fn(),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: mockNodeProfilingIntegration,
}));

describe('sentry.service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe('sentryEnabled', () => {
    it('is falsy when SENTRY_DSN is not set', async () => {
      delete process.env.SENTRY_DSN;
      process.env.PRODUCTION = 'true';
      const { sentryEnabled } = await import('../sentry.service');
      expect(sentryEnabled).toBeFalsy();
    });

    it('is false when PRODUCTION is not true', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.PRODUCTION = 'false';
      const { sentryEnabled } = await import('../sentry.service');
      expect(sentryEnabled).toBe(false);
    });

    it('is false when PRODUCTION is not set', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      delete process.env.PRODUCTION;
      const { sentryEnabled } = await import('../sentry.service');
      expect(sentryEnabled).toBe(false);
    });

    it('is true when both SENTRY_DSN and PRODUCTION=true are set', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.PRODUCTION = 'true';
      const { sentryEnabled } = await import('../sentry.service');
      expect(sentryEnabled).toBe(true);
    });
  });

  describe('loadSentry', () => {
    it('initializes Sentry when enabled', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.PRODUCTION = 'true';

      const { loadSentry } = await import('../sentry.service');
      const result = loadSentry();

      expect(mockSentryInit).toHaveBeenCalledWith({
        dsn: 'https://test@sentry.io/123',
        integrations: [expect.any(Object)],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
      });
      expect(result).not.toBeNull();
    });

    it('returns null when not enabled', async () => {
      delete process.env.SENTRY_DSN;
      process.env.PRODUCTION = 'false';

      const { loadSentry } = await import('../sentry.service');
      const result = loadSentry();

      expect(mockSentryInit).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('uses nodeProfilingIntegration in integrations', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.PRODUCTION = 'true';

      const { loadSentry } = await import('../sentry.service');
      loadSentry();

      expect(mockNodeProfilingIntegration).toHaveBeenCalled();
      const callArgs = mockSentryInit.mock.calls[0][0];
      expect(callArgs.integrations).toHaveLength(1);
    });
  });
});
