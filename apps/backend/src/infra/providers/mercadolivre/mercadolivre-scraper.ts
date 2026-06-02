import type { BrowserContext, Page, Request, Route } from 'playwright';
import { createOpenClawFallback } from '../openclaw/openclaw-factory';
import type { OpenClawField, OpenClawHint } from '../openclaw/openclaw-types';
import { OlxBrowserFactory } from '../olx/olx-browser-factory';
import { buildMercadoLivreSearchUrl } from './mercadolivre-url-builder';
import type { MercadoLivreListing, MercadoLivreScrapeDebug, MercadoLivreScrapeOptions, MercadoLivreScrapeResult, MercadoLivreSearchFilters } from './mercadolivre-types';

const NAV_TIMEOUT_MS = Number(process.env.MERCADOLIVRE_NAV_TIMEOUT_MS ?? 45000);
const SEARCH_TIMEOUT_MS = Number(process.env.MERCADOLIVRE_SEARCH_TIMEOUT_MS ?? 90000);
const MAX_DETAIL_FAILURES = Number(process.env.MERCADOLIVRE_MAX_DETAIL_FAILURES ?? 10);
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
const BLOCKED_URL_SNIPPETS = ['doubleclick', 'googletagmanager', 'google-analytics', 'analytics', 'gtm', 'hotjar', 'facebook', 'pixel', 'adservice', 'criteo', 'taboola'];

type MercadoLivreCard = {
  url: string;
  text: string;
  imageUrl: string | null;
};

function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function trimToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') return trimToNull(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrice(text: string): number | null {
  const moneyMatch = text.match(/R\$\s*([0-9.]+(?:,[0-9]{2})?)/i) ?? text.match(/([0-9.]{4,})\s*(?:reais?|reales?)/i);
  if (!moneyMatch) return null;
  const parsed = Number(moneyMatch[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseYear(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseKm(text: string): number | null {
  const match = text.match(/([0-9][0-9.\s]*)\s*(?:km|kms)\b/i);
  return match ? readNumber(match[1]) : null;
}

function parseFuel(text: string): string | null {
  const comparable = normalizeComparable(text);
  if (comparable.includes('eletric')) return 'Elétrico';
  if (comparable.includes('hibrid')) return 'Híbrido';
  if (comparable.includes('gasolina')) return 'Gasolina';
  if (comparable.includes('diesel')) return 'Diesel';
  if (comparable.includes('etanol')) return 'Etanol';
  if (comparable.includes('flex')) return 'Flex';
  return null;
}

function parseTransmission(text: string): string | null {
  const comparable = normalizeComparable(text);
  if (comparable.includes('automatic')) return 'Automático';
  if (comparable.includes('manual')) return 'Manual';
  return null;
}

function parseLocation(text: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const blockedPatterns = [
    /^r\$/i,
    /reais?/i,
    /reales?/i,
    /\b(19|20)\d{2}\b/,
    /\b[0-9][0-9.\s]*\s*(?:km|kms)\b/i,
    /loja oficial/i,
    /não verificado/i,
    /nao verificado/i,
    /vistoriado/i,
    /sem acidentes/i,
    /sem roubos/i,
    /placa e chassi verificados/i,
    /salvar esta busca/i
  ];

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!/[a-zA-ZÀ-ÿ]/.test(line)) continue;
    if (blockedPatterns.some((pattern) => pattern.test(line))) continue;
    if (line.length > 80) continue;
    return line;
  }

  return null;
}

function shouldBlockRequest(request: Request): boolean {
  if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) return true;
  const url = request.url().toLowerCase();
  return BLOCKED_URL_SNIPPETS.some((snippet) => url.includes(snippet));
}

async function setupRequestInterception(page: Page): Promise<void> {
  await page.route('**/*', (route: Route) => {
    if (shouldBlockRequest(route.request())) {
      return route.abort();
    }

    return route.continue();
  });
}

async function createPageWithProxy(browserFactory: OlxBrowserFactory, sessionId?: string): Promise<{ context: BrowserContext; page: Page }> {
  const { context } = await browserFactory.createContext(sessionId);
  const page = await context.newPage();
  await setupRequestInterception(page);
  return { context, page };
}

async function waitForResults(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: Math.min(SEARCH_TIMEOUT_MS, 15000) }).catch(() => undefined);
  await page.waitForSelector('a[href*="MLB-"]', { timeout: SEARCH_TIMEOUT_MS }).catch(() => undefined);
}

async function waitForDetailPage(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
}

function isLikelyListingUrl(value: string): boolean {
  const cleaned = value.toLowerCase().split('#')[0].split('?')[0];
  return cleaned.includes('mercadolivre.com.br') && cleaned.includes('mlb-');
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractCard(card: MercadoLivreCard): MercadoLivreListing | null {
  const text = card.text.trim();
  if (!text) return null;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = trimToNull(lines[0]) ?? trimToNull(text);
  if (!title) return null;

  return {
    url: card.url,
    title,
    price: parsePrice(text),
    year: parseYear(text),
    km: parseKm(text),
    fuel: parseFuel(text),
    transmission: parseTransmission(text),
    city: parseLocation(text),
    state: 'SP',
    photos: card.imageUrl ? [card.imageUrl] : []
  };
}

async function extractCards(page: Page, baseUrl: string): Promise<MercadoLivreCard[]> {
  return page.evaluate((currentBaseUrl) => {
    const anchors = Array.from(document.querySelectorAll('a[href*="MLB-"]')) as HTMLAnchorElement[];
    const seen = new Set<string>();
    const cards: Array<{ url: string; text: string; imageUrl: string | null }> = [];

    for (const anchor of anchors) {
      const href = anchor.href || anchor.getAttribute('href') || '';
      if (!href) continue;

      const absoluteUrl = new URL(href, currentBaseUrl).toString();
      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      const root = anchor.closest('article, li, section, div') ?? anchor;
      const text = root.textContent?.trim() || anchor.textContent?.trim() || '';
      if (!text) continue;

      const image = root.querySelector('img') as HTMLImageElement | null;
      const imageUrl = image?.currentSrc || image?.src || image?.getAttribute('data-src') || image?.getAttribute('data-lazy') || null;

      cards.push({ url: absoluteUrl, text, imageUrl });
    }

    return cards;
  }, baseUrl) as Promise<MercadoLivreCard[]>;
}

function mergePhotos(...groups: Array<string[] | null | undefined>): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    if (!group) continue;
    for (const photo of group) {
      if (!photo || seen.has(photo)) continue;
      seen.add(photo);
      output.push(photo);
    }
  }

  return output;
}

function readMissingFields(listing: Partial<MercadoLivreListing>): OpenClawField[] {
  const missing: OpenClawField[] = [];

  if (!listing.title) missing.push('title');
  if (listing.price === null || listing.price === undefined) missing.push('price');
  if (listing.year === null || listing.year === undefined) missing.push('year');
  if (listing.km === null || listing.km === undefined) missing.push('km');
  if (!listing.fuel) missing.push('fuel');
  if (!listing.city && !listing.state) missing.push('location');
  if (!listing.transmission) missing.push('transmission');
  if (!listing.photos || listing.photos.length === 0) missing.push('images');

  return missing;
}

function applyOpenClawHints(base: Partial<MercadoLivreListing>, hints: OpenClawHint[]): Partial<MercadoLivreListing> {
  const output: Partial<MercadoLivreListing> = { ...base };

  for (const hint of hints) {
    switch (hint.field) {
      case 'title':
        output.title = output.title ?? readString(hint.value) ?? undefined;
        break;
      case 'price':
        if (output.price === null || output.price === undefined) {
          output.price = typeof hint.value === 'number' ? Math.trunc(hint.value) : parsePrice(readString(hint.value) ?? '');
        }
        break;
      case 'year':
        if (output.year === null || output.year === undefined) {
          output.year = typeof hint.value === 'number' ? Math.trunc(hint.value) : parseYear(readString(hint.value) ?? '');
        }
        break;
      case 'km':
        if (output.km === null || output.km === undefined) {
          output.km = typeof hint.value === 'number' ? Math.trunc(hint.value) : parseKm(readString(hint.value) ?? '');
        }
        break;
      case 'fuel':
        output.fuel = output.fuel ?? readString(hint.value) ?? undefined;
        break;
      case 'location':
        output.city = output.city ?? readString(hint.value) ?? undefined;
        if (!output.state) output.state = 'SP';
        break;
      case 'transmission':
        output.transmission = output.transmission ?? readString(hint.value) ?? undefined;
        break;
      case 'images': {
        if (!output.photos || output.photos.length === 0) {
          if (Array.isArray(hint.value)) {
            output.photos = hint.value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
          } else if (typeof hint.value === 'string' && hint.value.trim()) {
            output.photos = [hint.value.trim()];
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return output;
}

async function extractDetailListing(page: Page, url: string, openClaw = createOpenClawFallback()): Promise<Partial<MercadoLivreListing> | null> {
  const detailPage = await page.context().newPage();
  try {
    await setupRequestInterception(detailPage);
    await detailPage.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await waitForDetailPage(detailPage);

    const bodyText = await detailPage.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const title = trimToNull(await detailPage.locator('h1').first().textContent({ timeout: 3000 }).catch(() => null)) ?? trimToNull(bodyText.split('\n')[0]);
    const priceText = trimToNull(await detailPage.locator('[itemprop="price"]').first().textContent({ timeout: 3000 }).catch(() => null));
    const images = await detailPage.evaluate(() => Array.from(document.querySelectorAll('img')).map((img) => {
      const element = img as HTMLImageElement;
      return element.currentSrc || element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy') || null;
    }).filter((value): value is string => typeof value === 'string' && value.startsWith('http'))).catch(() => [] as string[]);

    const base: Partial<MercadoLivreListing> = {
      url,
      title: title ?? undefined,
      price: priceText ? parsePrice(priceText) : parsePrice(bodyText),
      year: parseYear(bodyText),
      km: parseKm(bodyText),
      fuel: parseFuel(bodyText),
      transmission: parseTransmission(bodyText),
      city: parseLocation(bodyText),
      state: 'SP',
      photos: mergePhotos(images)
    };

    const missingFields = readMissingFields(base);
    if (missingFields.length === 0) return base;

    const result = await openClaw.analyze({
      portal: 'MERCADO_LIVRE',
      url,
      html: await detailPage.content().catch(() => null),
      missingFields,
      context: { source: 'mercadolivre' }
    });

    return result ? applyOpenClawHints(base, result.hints) : base;
  } finally {
    await detailPage.close().catch(() => undefined);
  }
}

function isBlockedText(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeComparable(value);
  return ['sorry, you have been blocked', 'access denied', 'acesso negado', 'voce foi bloqueado'].some((marker) => normalized.includes(marker));
}

export class MercadoLivreScraper {
  constructor(private readonly browserFactory = new OlxBrowserFactory()) {}

  async search(filters: MercadoLivreSearchFilters, options: MercadoLivreScrapeOptions): Promise<MercadoLivreScrapeResult> {
    const { context, page } = await createPageWithProxy(this.browserFactory, options.sessionId);
    const debug: MercadoLivreScrapeDebug = { pages: [], collected: 0, detailAttempts: 0, detailErrors: 0 };
    const listings: MercadoLivreListing[] = [];
    const seen = new Set<string>();

    try {
      const url = buildMercadoLivreSearchUrl(filters);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      await waitForResults(page);

      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      if (isBlockedText(bodyText)) {
        throw new Error('Mercado Livre blocked');
      }

      const cards = await extractCards(page, url);
      debug.pages.push({ page: 1, url, cardCount: cards.length, collected: 0 });

      const adsLimit = Math.max(1, Math.min(Math.trunc(options.maxAds) || 10, 10));
      const searchDeadline = Date.now() + SEARCH_TIMEOUT_MS;

      for (const card of cards) {
        if (listings.length >= adsLimit) break;
        if (Date.now() >= searchDeadline) {
          console.warn('[mercadolivre.scraper] search timeout during details', { collected: listings.length });
          break;
        }

        const absoluteUrl = normalizeUrl(card.url, url);
        if (!absoluteUrl || !isLikelyListingUrl(absoluteUrl) || seen.has(absoluteUrl)) continue;

        const parsed = extractCard({ ...card, url: absoluteUrl, imageUrl: card.imageUrl ? normalizeUrl(card.imageUrl, url) : null });
        if (!parsed) continue;

        let resolved = parsed;

        if (resolved.price === null || resolved.year === null) {
          debug.detailAttempts += 1;
          try {
            const detail = await extractDetailListing(page, resolved.url);
            if (detail) {
              resolved = {
                ...resolved,
                ...detail,
                photos: mergePhotos(resolved.photos, detail.photos)
              };
            }
          } catch {
            debug.detailErrors += 1;
            if (debug.detailErrors >= MAX_DETAIL_FAILURES) break;
          }
        }

        if (resolved.price === null || resolved.year === null) continue;

        seen.add(resolved.url);
        listings.push(resolved);
        debug.pages[0].collected = listings.length;
      }

      debug.collected = listings.length;
      return { listings, debug };
    } finally {
      await context.close().catch(() => undefined);
    }
  }
}