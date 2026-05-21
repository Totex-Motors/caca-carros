import type { OpenClawAdapter } from './openclaw-adapter';
import { OpenClawDisabledAdapter } from './openclaw-disabled-adapter';
import type { OpenClawAnalysisInput, OpenClawAnalysisResult } from './openclaw-types';

const DEFAULT_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise as Promise<T>;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

export class OpenClawFallback {
  constructor(private readonly adapter: OpenClawAdapter = new OpenClawDisabledAdapter()) {}

  isEnabled(): boolean {
    const flag = process.env.OPENCLAW_ENABLED ?? 'false';
    if (flag.toLowerCase() !== 'true') return false;
    return this.adapter.isEnabled();
  }

  async analyze(input: OpenClawAnalysisInput): Promise<OpenClawAnalysisResult | null> {
    if (!this.isEnabled()) return null;
    if (input.missingFields.length === 0) return null;

    const timeoutMs = Number(process.env.OPENCLAW_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    const result = await withTimeout(this.adapter.analyze(input), timeoutMs);

    return result ?? null;
  }
}
