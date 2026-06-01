import type { OpenClawAdapter } from './openclaw-adapter';
import type { OpenClawAnalysisInput, OpenClawAnalysisResult, OpenClawHint } from './openclaw-types';

const DEFAULT_PATH = '/analyze';

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildUrl(baseUrl: string, path: string): string {
  if (!path.startsWith('/')) return `${baseUrl}/${path}`;
  return `${baseUrl}${path}`;
}

type OpenClawHttpConfig = {
  baseUrl: string;
  token: string;
  path: string;
};

type RawHint = Record<string, unknown> & {
  field?: unknown;
  value?: unknown;
  selector?: unknown;
  confidence?: unknown;
};

function normalizeHintValue(value: unknown): string | number | string[] | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (Array.isArray(value)) {
    const cleaned = value.filter((entry): entry is string => typeof entry === 'string');
    return cleaned.length > 0 ? cleaned : null;
  }
  return null;
}

function normalizeHints(raw: unknown): OpenClawHint[] {
  if (!Array.isArray(raw)) return [];

  const output: OpenClawHint[] = [];
  for (const entry of raw as RawHint[]) {
    if (!entry || typeof entry !== 'object') continue;
    const field = typeof entry.field === 'string' ? entry.field : null;
    if (!field) continue;
    const confidence = typeof entry.confidence === 'number' && Number.isFinite(entry.confidence) ? entry.confidence : null;
    const selector = typeof entry.selector === 'string' ? entry.selector : null;

    output.push({
      field: field as OpenClawHint['field'],
      value: normalizeHintValue(entry.value),
      selector,
      confidence
    });
  }

  return output;
}

function resolveResult(raw: unknown): OpenClawAnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const hints = normalizeHints(record.hints ?? (record.data as Record<string, unknown> | undefined)?.hints);
  if (hints.length === 0) return { hints: [], raw };

  return { hints, raw };
}

export class OpenClawHttpAdapter implements OpenClawAdapter {
  private readonly config: OpenClawHttpConfig | null;

  constructor(config?: Partial<OpenClawHttpConfig>) {
    const baseUrl = normalizeBaseUrl(config?.baseUrl ?? readEnv('OPENCLAW_API_URL') ?? '');
    const token = config?.token ?? readEnv('OPENCLAW_API_TOKEN') ?? readEnv('OPENCLAW_API_KEY') ?? '';
    const path = config?.path ?? readEnv('OPENCLAW_API_PATH') ?? DEFAULT_PATH;

    this.config = baseUrl && token ? { baseUrl, token, path } : null;
  }

  isEnabled(): boolean {
    return Boolean(this.config);
  }

  async analyze(input: OpenClawAnalysisInput): Promise<OpenClawAnalysisResult | null> {
    if (!this.config) return null;

    const url = buildUrl(this.config.baseUrl, this.config.path);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`,
        'x-api-key': this.config.token
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    return resolveResult(payload);
  }
}
