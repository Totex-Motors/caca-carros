import { chromium, type Browser, type BrowserContext, type BrowserContextOptions } from 'playwright';
import { OlxProxyPool, type OlxProxyConfig } from './olx-proxy';

type ContextProfile = {
  userAgent: string;
  viewport: { width: number; height: number };
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15'
];

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 }
];

const CHROMIUM_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildContextOptions(): { options: BrowserContextOptions; profile: ContextProfile } {
  const userAgent = pickRandom(USER_AGENTS);
  const viewport = pickRandom(VIEWPORTS);

  return {
    options: {
      userAgent,
      viewport,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo'
    },
    profile: { userAgent, viewport }
  };
}

export class OlxBrowserFactory {
  private readonly browsers = new Map<string, Browser>();

  constructor(private readonly proxyPool = new OlxProxyPool()) {}

  async createContext(sessionId?: string): Promise<{ context: BrowserContext; proxy: OlxProxyConfig; profile: ContextProfile }> {
    const proxy = this.proxyPool.getProxy(sessionId);
    const browser = await this.getBrowser(proxy);
    const { options, profile } = buildContextOptions();
    const context = await browser.newContext(options);
    return { context, proxy, profile };
  }

  async closeAll(): Promise<void> {
    const entries = Array.from(this.browsers.values());
    this.browsers.clear();
    await Promise.all(entries.map((browser) => browser.close().catch(() => undefined)));
  }

  private async getBrowser(proxy: OlxProxyConfig): Promise<Browser> {
    const key = `${proxy.host}:${proxy.port}:${proxy.username}`;
    const cached = this.browsers.get(key);
    if (cached) return cached;

    const browser = await chromium.launch({
      headless: true,
      args: CHROMIUM_ARGS,
      proxy: {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password
      }
    });

    this.browsers.set(key, browser);
    return browser;
  }
}
