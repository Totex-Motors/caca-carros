import type { Page, Request, Route } from 'playwright';
import { OlxBrowserFactory } from './olx-browser-factory';
import { buildOlxSearchUrl } from './olx-url-builder';
import type { OlxCardData, OlxDetailData, OlxListing, OlxScrapeDebug, OlxScrapeOptions, OlxScrapeResult, OlxSearchFilters } from './olx-types';
import { OpenClawFallback } from '../openclaw/openclaw-fallback';
import { createOpenClawFallback } from '../openclaw/openclaw-factory';
import type { OpenClawField, OpenClawHint } from '../openclaw/openclaw-types';

const NAV_TIMEOUT_MS = Number(process.env.OLX_NAV_TIMEOUT_MS ?? 45000);
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
const BLOCKED_URL_SNIPPETS = [
  'doubleclick',
  'googletagmanager',
  'google-analytics',
  'analytics',
  'gtm',
  'hotjar',
  'facebook',
  'pixel',
  'ads',
  'adservice',
  'criteo',
  'taboola'
];

const LIST_WAIT_SELECTORS = [
  '[data-testid*="ad"]',
  '[data-testid*="listing"]',
  '[data-testid*="item"]',
  'a[href*="/autos-e-pecas/"]',
  'a[href*="/carros-vans-e-utilitarios/"]'
];

const DETAIL_WAIT_SELECTORS = [
  'h1',
  '[data-testid*="ad-title"]',
  '[data-testid*="description"]',
  'main'
];

const DEFAULT_MAX_PAGES = 5;

function isOlxDebugEnabled(): boolean {
  const flag = process.env.OLX_DEBUG_ERRORS ?? 'false';
  return flag.toLowerCase() === 'true';
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(page: Page, minMs: number, maxMs: number): Promise<void> {
  await page.waitForTimeout(randomInt(minMs, maxMs));
}

async function waitForAnySelector(page: Page, selectors: string[], timeoutMs: number): Promise<string | null> {
  const perSelector = Math.max(1000, Math.floor(timeoutMs / Math.max(1, selectors.length)));

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: perSelector, state: 'attached' });
      return selector;
    } catch {
      continue;
    }
  }

  return null;
}

function trimToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;
  return trimmed.replace(/\s+/g, ' ');
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : null))
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  const single = readString(value);
  return single ? [single] : [];
}

function mergePhotos(...groups: Array<string[] | null | undefined>): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    if (!group) continue;
    for (const photo of group) {
      if (!photo || typeof photo !== 'string') continue;
      if (seen.has(photo)) continue;
      seen.add(photo);
      output.push(photo);
    }
  }

  return output;
}

function normalizeLocation(value: string | null | undefined): { location: string | null; city: string | null; state: string | null } {
  const normalized = normalizeText(value);
  if (!normalized) return { location: null, city: null, state: null };

  const parts = normalized.split(/[-•]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].toUpperCase();
    const city = parts.slice(0, -1).join(' ').trim();
    return {
      location: `${city} - ${state}`.trim(),
      city: city || null,
      state: state || null
    };
  }

  return { location: normalized, city: null, state: null };
}

function normalizePostedAt(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const lower = normalized.toLowerCase();
  const comparable = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const now = new Date();

  if (comparable.includes('hoje')) {
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).toISOString();
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  if (comparable.includes('ontem')) {
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes).toISOString();
    }
    return base.toISOString();
  }

  const dateMatch = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]) - 1;
    const yearRaw = dateMatch[3];
    const year = yearRaw ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : now.getFullYear();
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      return new Date(year, month, day).toISOString();
    }
  }

  const relativeMatch = comparable.match(/ha\s+(\d+)\s+(minuto|minutos|hora|horas|dia|dias)/);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    if (Number.isFinite(amount)) {
      const deltaMs =
        unit.startsWith('minuto')
          ? amount * 60 * 1000
          : unit.startsWith('hora')
            ? amount * 60 * 60 * 1000
            : amount * 24 * 60 * 60 * 1000;
      return new Date(Date.now() - deltaMs).toISOString();
    }
  }

  return null;
}

function shouldBlockRequest(request: Request): boolean {
  const resourceType = request.resourceType();
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) return true;

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

async function humanScroll(page: Page): Promise<void> {
  const steps = randomInt(4, 8);
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, randomInt(300, 800));
    await randomDelay(page, 200, 500);
  }
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function readNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNumberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return readNumber(value);
  if (value && typeof value === 'object' && 'value' in value) {
    return readNumberFromUnknown((value as { value?: unknown }).value);
  }
  return null;
}

function getMissingFields(listing: Partial<OlxListing>): OpenClawField[] {
  const missing: OpenClawField[] = [];

  if (!listing.title) missing.push('title');
  if (listing.price === null || listing.price === undefined) missing.push('price');
  if (listing.year === null || listing.year === undefined) missing.push('year');
  if (listing.km === null || listing.km === undefined) missing.push('km');
  if (!listing.fuel) missing.push('fuel');
  if (!listing.color) missing.push('color');
  if (!listing.description) missing.push('description');
  if (!listing.location) missing.push('location');
  if (!listing.postedAt) missing.push('postedAt');
  if (!listing.transmission) missing.push('transmission');
  if (!listing.photos || listing.photos.length === 0) missing.push('images');

  return missing;
}

function applyOpenClawHints(base: Partial<OlxListing>, hints: OpenClawHint[]): Partial<OlxListing> {
  const updated: Partial<OlxListing> = { ...base };

  for (const hint of hints) {
    switch (hint.field) {
      case 'title':
        if (!updated.title && typeof hint.value === 'string') {
          updated.title = normalizeText(hint.value) ?? updated.title;
        }
        break;
      case 'price':
        if (updated.price === null || updated.price === undefined) {
          updated.price = readNumberFromUnknown(hint.value ?? null);
        }
        break;
      case 'year':
        if (updated.year === null || updated.year === undefined) {
          if (typeof hint.value === 'number' && Number.isFinite(hint.value)) {
            updated.year = Math.trunc(hint.value);
          } else if (typeof hint.value === 'string') {
            updated.year = extractYear(hint.value);
          }
        }
        break;
      case 'km':
        if (updated.km === null || updated.km === undefined) {
          updated.km = readNumberFromUnknown(hint.value ?? null);
        }
        break;
      case 'fuel':
        if (!updated.fuel && typeof hint.value === 'string') {
          updated.fuel = normalizeText(hint.value);
        }
        break;
      case 'color':
        if (!updated.color && typeof hint.value === 'string') {
          updated.color = normalizeText(hint.value);
        }
        break;
      case 'description':
        if (!updated.description && typeof hint.value === 'string') {
          updated.description = normalizeText(hint.value);
        }
        break;
      case 'location':
        if (!updated.location && typeof hint.value === 'string') {
          const normalized = normalizeLocation(hint.value);
          updated.location = normalized.location;
          updated.city = updated.city ?? normalized.city;
          updated.state = updated.state ?? normalized.state;
        }
        break;
      case 'postedAt':
        if (!updated.postedAt && typeof hint.value === 'string') {
          updated.postedAt = normalizePostedAt(hint.value);
        }
        break;
      case 'transmission':
        if (!updated.transmission && typeof hint.value === 'string') {
          updated.transmission = normalizeText(hint.value);
        }
        break;
      case 'images':
        if (Array.isArray(hint.value)) {
          updated.photos = mergePhotos(updated.photos ?? [], hint.value);
        } else if (typeof hint.value === 'string') {
          updated.photos = mergePhotos(updated.photos ?? [], [hint.value]);
        }
        break;
      default:
        break;
    }
  }

  return updated;
}

function extractYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeListing(raw: Partial<OlxListing>, baseUrl: string): OlxListing | null {
  const url = raw.url ? normalizeUrl(raw.url, baseUrl) : null;
  const title = raw.title?.trim() ?? '';
  if (!url || !title) return null;

  const locationParts = normalizeLocation(raw.location ?? null);
  const city = raw.city ?? locationParts.city ?? null;
  const state = raw.state ?? locationParts.state ?? null;

  return {
    url,
    title,
    price: raw.price ?? null,
    year: raw.year ?? null,
    km: raw.km ?? null,
    fuel: raw.fuel ?? null,
    color: raw.color ?? null,
    description: raw.description ?? null,
    location: raw.location ?? locationParts.location ?? null,
    postedAt: raw.postedAt ?? null,
    transmission: raw.transmission ?? null,
    city,
    state,
    photos: Array.isArray(raw.photos) ? raw.photos.filter((photo) => typeof photo === 'string') : []
  };
}

function extractListingsFromLdJson(rawScripts: string[], baseUrl: string): OlxListing[] {
  const output: OlxListing[] = [];

  for (const script of rawScripts) {
    if (!script) continue;

    try {
      const parsed = JSON.parse(script) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const itemList = (item as { itemListElement?: unknown }).itemListElement;

        if (Array.isArray(itemList)) {
          for (const element of itemList) {
            if (!element || typeof element !== 'object') continue;
            const entry = (element as { item?: unknown }).item ?? element;
            if (!entry || typeof entry !== 'object') continue;

            const url = (entry as { url?: unknown }).url;
            const title = (entry as { name?: unknown; title?: unknown }).name ?? (entry as { title?: unknown }).title;
            const offers = (entry as { offers?: { price?: unknown } }).offers;
            const price = offers?.price ?? (entry as { price?: unknown }).price;
            const image = (entry as { image?: unknown }).image;
            const description = (entry as { description?: unknown }).description;
            const datePosted = (entry as { datePosted?: unknown }).datePosted;
            const fuelType = (entry as { fuelType?: unknown }).fuelType;
            const color = (entry as { color?: unknown }).color;
            const locationName = (entry as { location?: { name?: unknown } }).location?.name;
            const address = (entry as { address?: { addressLocality?: unknown; addressRegion?: unknown } }).address;
            const locationFallback = address?.addressLocality ?? address?.addressRegion;

            const normalized = normalizeListing(
              {
                url: typeof url === 'string' ? url : undefined,
                title: typeof title === 'string' ? title : '',
                price: typeof price === 'number' ? price : readNumber(typeof price === 'string' ? price : null),
                photos: Array.isArray(image) ? image.filter((img) => typeof img === 'string') : typeof image === 'string' ? [image] : [],
                description: readString(description),
                fuel: readString(fuelType),
                color: readString(color),
                location: readString(locationName ?? locationFallback),
                postedAt: normalizePostedAt(readString(datePosted))
              },
              baseUrl
            );

            if (normalized) output.push(normalized);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return output;
}

type RawCard = OlxCardData;

async function extractListingsFromCards(page: Page): Promise<RawCard[]> {
  return page.$$eval('a', (anchors: Element[]) => {
    const results: RawCard[] = [];

    function isListingLink(anchor: Element, href: string): boolean {
      const value = href.trim();
      if (!value) return false;
      const lower = value.toLowerCase();
      if (lower.startsWith('#') || lower.startsWith('mailto:') || lower.startsWith('tel:')) return false;

      const isOlxLink = lower.includes('olx.com.br') || lower.startsWith('/');
      if (!isOlxLink) return false;

      if (lower.includes('/item/') || lower.includes('/d/')) return true;
      if (lower.includes('/autos-e-pecas/') || lower.includes('/carros-vans-e-utilitarios/')) return true;

      const testId = anchor.getAttribute('data-testid') || '';
      if (testId.toLowerCase().includes('ad')) return true;

      const dataLurker = anchor.getAttribute('data-lurker-detail');
      if (dataLurker) return true;

      const parentTestId = anchor.closest('[data-testid]')?.getAttribute('data-testid') || '';
      if (parentTestId.toLowerCase().includes('ad')) return true;

      const hasNumericId = /\d{6,}/.test(lower);
      return hasNumericId && lower.includes('olx.com.br');
    }

    function findMetaText(values: string[], pattern: RegExp): string | null {
      return values.find((entry) => pattern.test(entry)) ?? null;
    }

    function findBySelectors(root: Element, selectors: string[]): string | null {
      for (const selector of selectors) {
        const el = root.querySelector(selector);
        const text = el?.textContent?.trim();
        if (text) return text;
      }
      return null;
    }

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || '';
      if (!href) continue;
      if (!isListingLink(anchor, href)) continue;

      const titleEl = anchor.querySelector('h2, h3, [data-testid*="title"], [data-testid*="ad-title"]');
      const priceEl = anchor.querySelector('[data-testid*="price"], [class*="price"]');
      const locationEl = anchor.querySelector('[data-testid*="location"], [class*="location"]');
      const dateEl = anchor.querySelector('time, [data-testid*="date"], [class*="date"]');
      const imageEl = anchor.querySelector('img');

      const metaTexts = Array.from(anchor.querySelectorAll('span, li, div'))
        .map((el) => el.textContent?.trim() || '')
        .filter((text) => text.length > 0);

      const title = titleEl?.textContent?.trim() || anchor.getAttribute('title') || '';
      const priceText = priceEl?.textContent?.trim() || findMetaText(metaTexts, /R\$|\$/i) || '';
      const locationText = locationEl?.textContent?.trim() || findMetaText(metaTexts, /\b[A-Z]{2}\b/) || '';
      const dateText = dateEl?.textContent?.trim() || findMetaText(metaTexts, /(hoje|ontem|\d{1,2}\/\d{1,2}|ha\s+\d+)/i) || '';
      const kmText = findMetaText(metaTexts, /\bkm\b/i) || '';
      const yearText = findMetaText(metaTexts, /\b(19|20)\d{2}\b/) || '';
      const fuelText = findMetaText(metaTexts, /(flex|gasolina|diesel|hibrid|eletr)/i) || '';
      const imageUrl = imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src') || null;

      const normalizedLocation =
        locationText ||
        findBySelectors(anchor, ['[data-testid*="location"]', '[class*="location"]']);

      if (!title) continue;

      results.push({
        url: href,
        title,
        priceText: priceText || null,
        locationText: normalizedLocation || null,
        dateText: dateText || null,
        kmText: kmText || null,
        yearText: yearText || null,
        fuelText: fuelText || null,
        imageUrl
      });
    }

    return results;
  });
}

function normalizeCardListing(card: RawCard, baseUrl: string): OlxListing | null {
  const locationParts = normalizeLocation(card.locationText);
  const city = locationParts.city;
  const state = locationParts.state;
  const location = locationParts.location;
  const normalized = normalizeListing(
    {
      url: card.url,
      title: card.title,
      price: readNumber(card.priceText ?? null),
      year: extractYear(card.yearText ?? card.title),
      km: readNumber(card.kmText ?? null),
      fuel: normalizeText(card.fuelText),
      city,
      state,
      location,
      postedAt: normalizePostedAt(card.dateText),
      photos: card.imageUrl ? [card.imageUrl] : []
    },
    baseUrl
  );

  return normalized;
}

function extractDetailsFromLdJson(rawScripts: string[], baseUrl: string): Partial<OlxListing> | null {
  for (const script of rawScripts) {
    if (!script) continue;

    try {
      const parsed = JSON.parse(script) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const offered = (record.itemOffered as Record<string, unknown> | undefined) ?? record;
        const offers = (record.offers as Record<string, unknown> | undefined) ?? (offered.offers as Record<string, unknown> | undefined);

        const url = readString(record.url ?? offered.url);
        const title = readString(record.name ?? offered.name ?? record.title ?? offered.title);
        const price = readNumberFromUnknown(offers?.price ?? record.price ?? offered.price);
        const description = readString(record.description ?? offered.description);
        const fuel = readString(record.fuelType ?? offered.fuelType);
        const color = readString(record.color ?? offered.color);
        const datePosted = readString(record.datePosted ?? offered.datePosted);
        const locationName = readString(
          (record.location as { name?: unknown } | undefined)?.name ??
          (record.address as { addressLocality?: unknown; addressRegion?: unknown } | undefined)?.addressLocality ??
          (record.address as { addressLocality?: unknown; addressRegion?: unknown } | undefined)?.addressRegion
        );
        const photos = readStringArray(record.image ?? offered.image);
        const km = readNumberFromUnknown((record.mileageFromOdometer as { value?: unknown } | undefined)?.value ?? offered.mileageFromOdometer);
        const year = extractYear(readString(record.vehicleModelDate ?? offered.vehicleModelDate ?? record.productionDate ?? offered.productionDate));

        const locationParts = normalizeLocation(locationName);

        return {
          url: url ?? baseUrl,
          title: title ?? undefined,
          price,
          year,
          km,
          fuel,
          color,
          description,
          location: locationParts.location,
          city: locationParts.city,
          state: locationParts.state,
          postedAt: normalizePostedAt(datePosted),
          photos
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function extractDetailsFromDom(page: Page): Promise<OlxDetailData> {
  return page.evaluate(() => {
    function textFrom(selector: string): string | null {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      return text && text.length > 0 ? text : null;
    }

    function firstText(selectors: string[]): string | null {
      for (const selector of selectors) {
        const value = textFrom(selector);
        if (value) return value;
      }
      return null;
    }

    const titleText = firstText(['h1', '[data-testid*="ad-title"]', '[data-testid*="title"]']);
    const priceText = firstText(['[data-testid*="price"]', '[class*="price"]']);
    const descriptionText = firstText(['[data-testid*="description"]', '[class*="description"]', '[data-testid*="ad-description"]']);
    const locationText = firstText(['[data-testid*="location"]', '[class*="location"]']);
    const dateText = firstText(['time', '[data-testid*="date"]', '[class*="date"]']);

    const photos = Array.from(document.querySelectorAll('img'))
      .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || '')
      .filter((src) => src.length > 0 && src.startsWith('http'));

    const detailRows = Array.from(document.querySelectorAll('li, [data-testid*="property"], [data-testid*="spec"]'));
    let kmText: string | null = null;
    let yearText: string | null = null;
    let fuelText: string | null = null;
    let colorText: string | null = null;
    let transmissionText: string | null = null;

    function normalizeLabel(value: string): string {
      return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    }

    function extractLabelValue(row: Element): { label: string | null; value: string | null } {
      const labelEl = row.querySelector('dt, [data-testid*="label"], [class*="label"]');
      const valueEl = row.querySelector('dd, [data-testid*="value"], [class*="value"]');

      const label = labelEl?.textContent?.trim() || null;
      const value = valueEl?.textContent?.trim() || null;

      if (label && value) return { label, value };

      const raw = row.textContent?.trim() || '';
      if (!raw) return { label: null, value: null };
      const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return { label: parts[0], value: parts.slice(1).join(': ') };
      }

      return { label: raw, value: raw };
    }

    for (const row of detailRows) {
      const extracted = extractLabelValue(row);
      if (!extracted.label && !extracted.value) continue;
      const label = normalizeLabel(extracted.label ?? '');
      const value = extracted.value ?? extracted.label ?? '';

      if (!kmText && label.includes('km')) kmText = value;
      if (!yearText && label.includes('ano')) yearText = value;
      if (!fuelText && label.includes('combustivel')) fuelText = value;
      if (!colorText && label.includes('cor')) colorText = value;
      if (!transmissionText && (label.includes('cambio') || label.includes('transmissao'))) transmissionText = value;
    }

    return {
      titleText,
      priceText,
      descriptionText,
      locationText,
      dateText,
      kmText,
      yearText,
      fuelText,
      colorText,
      transmissionText,
      photos
    };
  });
}

function normalizeDetailListing(detail: OlxDetailData, baseUrl: string): Partial<OlxListing> {
  const locationParts = normalizeLocation(detail.locationText);

  return {
    url: baseUrl,
    title: detail.titleText ?? undefined,
    price: readNumber(detail.priceText ?? null),
    year: extractYear(detail.yearText ?? detail.titleText ?? null),
    km: readNumber(detail.kmText ?? null),
    fuel: normalizeText(detail.fuelText),
    color: normalizeText(detail.colorText),
    description: normalizeText(detail.descriptionText),
    transmission: normalizeText(detail.transmissionText),
    location: locationParts.location,
    city: locationParts.city,
    state: locationParts.state,
    postedAt: normalizePostedAt(detail.dateText),
    photos: detail.photos
  };
}

function mergeListing(base: OlxListing, detail: Partial<OlxListing> | null): OlxListing {
  if (!detail) return base;

  return {
    ...base,
    title: detail.title ?? base.title,
    price: detail.price ?? base.price,
    year: detail.year ?? base.year,
    km: detail.km ?? base.km,
    fuel: detail.fuel ?? base.fuel,
    color: detail.color ?? base.color,
    description: detail.description ?? base.description,
    location: detail.location ?? base.location,
    postedAt: detail.postedAt ?? base.postedAt,
    transmission: detail.transmission ?? base.transmission,
    city: detail.city ?? base.city,
    state: detail.state ?? base.state,
    photos: mergePhotos(base.photos, detail.photos ?? [])
  };
}

async function extractDetailListing(page: Page, url: string, openClaw: OpenClawFallback): Promise<Partial<OlxListing> | null> {
  await randomDelay(page, 300, 800);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Number.isFinite(NAV_TIMEOUT_MS) ? NAV_TIMEOUT_MS : 45000 });
  await waitForAnySelector(page, DETAIL_WAIT_SELECTORS, NAV_TIMEOUT_MS);
  await randomDelay(page, 300, 800);
  await humanScroll(page);

  const baseUrl = page.url();
  const ldJson = await page.$$eval('script[type="application/ld+json"]', (nodes: Element[]) =>
    nodes.map((node) => node.textContent || '')
  );
  const ldDetails = extractDetailsFromLdJson(ldJson, baseUrl);
  const domDetails = await extractDetailsFromDom(page);
  const normalizedDom = normalizeDetailListing(domDetails, baseUrl);

  const baseDetails: Partial<OlxListing> = {
    ...ldDetails,
    ...normalizedDom,
    photos: mergePhotos(ldDetails?.photos ?? [], normalizedDom.photos ?? [])
  };

  if (!openClaw.isEnabled()) return baseDetails;

  const missingFields = getMissingFields(baseDetails);
  if (missingFields.length === 0) return baseDetails;

  let html: string | null = null;
  try {
    html = await page.content();
  } catch {
    html = null;
  }

  const result = await openClaw.analyze({
    portal: 'OLX',
    url: baseUrl,
    html,
    missingFields,
    context: {
      pageType: 'detail'
    }
  });

  if (!result || result.hints.length === 0) return baseDetails;

  return applyOpenClawHints(baseDetails, result.hints);
}

async function runWithRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export class OlxScraper {
  constructor(
    private readonly browserFactory = new OlxBrowserFactory(),
    private readonly openClawFallback = createOpenClawFallback()
  ) {}

  async search(filters: OlxSearchFilters, options: OlxScrapeOptions): Promise<OlxScrapeResult> {
    const rawMaxPages = Number.isFinite(options.maxPages) ? Math.trunc(options.maxPages) : 0;
    const maxPages = rawMaxPages > 0 ? rawMaxPages : DEFAULT_MAX_PAGES;
    const debug: OlxScrapeDebug | null = isOlxDebugEnabled()
      ? { pages: [], collected: 0, detailAttempts: 0, detailErrors: 0 }
      : null;

    const { context } = await this.browserFactory.createContext(options.sessionId);
    const page = await context.newPage();
    const detailPage = await context.newPage();
    await setupRequestInterception(page);
    await setupRequestInterception(detailPage);

    const collected: OlxListing[] = [];
    const seen = new Set<string>();

    try {
      for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
        const url = buildOlxSearchUrl(filters, pageIndex);
        console.info('[olx.scraper] search page', { page: pageIndex, url });
        await randomDelay(page, 300, 800);
        await runWithRetries(
          () => page.goto(url, { waitUntil: 'domcontentloaded', timeout: Number.isFinite(NAV_TIMEOUT_MS) ? NAV_TIMEOUT_MS : 45000 }),
          Math.max(1, options.retryAttempts)
        );

        await waitForAnySelector(page, LIST_WAIT_SELECTORS, NAV_TIMEOUT_MS);

        await randomDelay(page, 300, 800);
        await humanScroll(page);

        const baseUrl = page.url();
        const ldJson = await page.$$eval('script[type="application/ld+json"]', (nodes: Element[]) =>
          nodes.map((node) => node.textContent || '')
        );

        // Prefer JSON-LD for structured data, then fall back to card scraping.
        const ldJsonListings = extractListingsFromLdJson(ldJson, baseUrl);
        let pageListingsCount = ldJsonListings.length;
        for (const listing of ldJsonListings) {
          if (seen.has(listing.url)) continue;
          seen.add(listing.url);
          collected.push(listing);
          if (collected.length >= options.maxAds) break;
        }

        if (collected.length >= options.maxAds) {
          if (debug) {
            debug.pages.push({ page: pageIndex, url, ldCount: ldJsonListings.length, cardCount: 0 });
          }
          break;
        }

        const cardListings = await extractListingsFromCards(page);
        pageListingsCount += cardListings.length;
        for (const card of cardListings) {
          const normalized = normalizeCardListing(card, baseUrl);
          if (!normalized) continue;
          if (seen.has(normalized.url)) continue;
          seen.add(normalized.url);
          collected.push(normalized);
          if (collected.length >= options.maxAds) break;
        }

        if (debug) {
          debug.pages.push({ page: pageIndex, url, ldCount: ldJsonListings.length, cardCount: cardListings.length });
          console.info('[olx.scraper] page stats', {
            page: pageIndex,
            url,
            ldCount: ldJsonListings.length,
            cardCount: cardListings.length
          });
        }

        if (collected.length >= options.maxAds) break;
        if (pageListingsCount === 0) break;
      }

      const enriched: OlxListing[] = [];
      for (const listing of collected) {
        if (debug) debug.detailAttempts += 1;
        let detail: Partial<OlxListing> | null = null;
        try {
          detail = await runWithRetries(
            () => extractDetailListing(detailPage, listing.url, this.openClawFallback),
            Math.max(1, options.retryAttempts)
          );
        } catch {
          if (debug) debug.detailErrors += 1;
          detail = null;
        }

        const merged = mergeListing(listing, detail);
        if (!merged.url || !merged.title) continue;
        enriched.push(merged);
        if (enriched.length >= options.maxAds) break;
      }

      if (debug) {
        debug.collected = enriched.length;
      }

      return { listings: enriched, debug: debug ?? undefined };
    } finally {
      await page.close().catch(() => undefined);
      await detailPage.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  }
}
