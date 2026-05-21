import { OpenClawFallback } from './openclaw-fallback';
import { OpenClawDisabledAdapter } from './openclaw-disabled-adapter';
import { OpenClawHttpAdapter } from './openclaw-http-adapter';

function readEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function createOpenClawFallback(): OpenClawFallback {
  const baseUrl = readEnv('OPENCLAW_API_URL');
  const token = readEnv('OPENCLAW_API_TOKEN') ?? readEnv('OPENCLAW_API_KEY');

  if (baseUrl && token) {
    return new OpenClawFallback(new OpenClawHttpAdapter({ baseUrl, token }));
  }

  return new OpenClawFallback(new OpenClawDisabledAdapter());
}
