import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { chromium, type Browser } from 'playwright';

// Le a pagina de um anuncio (qualquer portal) e extrai texto e fotos para a analise da IA.
// 1. Tenta um fetch simples com cabecalhos de navegador (rapido; funciona em parte dos portais).
// 2. Se o portal bloquear, abre com o Chromium do Playwright (usa o proxy PROXY_* quando configurado).

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_TEXTO = 12_000;
const MAX_FOTOS = 8;
const MAX_FOTO_BYTES = 4 * 1024 * 1024;

export type AnuncioLido = {
  url: string;
  fonte: 'fetch' | 'navegador';
  titulo: string;
  texto: string;
  fotos: string[]; // URLs das fotos encontradas na pagina
};

export class AnuncioBloqueadoError extends Error {}
export class UrlInvalidaError extends Error {}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === '::1' || a === '::') return true;
    if (a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80')) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Aceita so http(s) em portas padrao apontando para enderecos publicos (evita acesso a rede interna da VPS). */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlInvalidaError('Link invalido.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UrlInvalidaError('Use um link http(s).');
  if (url.port && url.port !== '80' && url.port !== '443') throw new UrlInvalidaError('Link invalido.');
  if (url.username || url.password) throw new UrlInvalidaError('Link invalido.');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (addresses.length === 0) throw new UrlInvalidaError('Nao foi possivel encontrar esse site.');
  if (addresses.some(isPrivateAddress)) throw new UrlInvalidaError('Link invalido.');
  return url;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
  const reAlt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
  const m = html.match(re) ?? html.match(reAlt);
  return m ? decodeEntities(m[1]).trim() : null;
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, ' DADOS ESTRUTURADOS: $1 ')
      .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|section)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function extractPhotos(html: string, baseUrl: string): string[] {
  const candidates: string[] = [];
  const og = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/gi) ?? [];
  for (const tag of og) {
    const m = tag.match(/content=["']([^"']+)["']/i);
    if (m) candidates.push(m[1]);
  }
  // Fotos em atributos de <img>, <source> e JSON embutido (galerias costumam vir assim).
  const re = /(https?:\/\/[^"'\s()<>]+?\.(?:jpe?g|webp|png)(?:\?[^"'\s()<>]*)?)/gi;
  for (const m of html.matchAll(re)) candidates.push(m[1]);

  const seen = new Set<string>();
  const fotos: string[] = [];
  for (const raw of candidates) {
    let url: string;
    try {
      url = new URL(decodeEntities(raw).replace(/\\\//g, '/'), baseUrl).toString();
    } catch {
      continue;
    }
    if (/logo|icon|sprite|avatar|placeholder|banner|selo|badge|favicon/i.test(url)) continue;
    // Mesma foto em tamanhos diferentes: compara sem a query string.
    const key = url.split('?')[0].replace(/\/(\d{2,4}x\d{2,4}|thumb|small|medium)\//i, '/');
    if (seen.has(key)) continue;
    seen.add(key);
    fotos.push(url);
    if (fotos.length >= MAX_FOTOS) break;
  }
  return fotos;
}

function parsePage(html: string, url: string, fonte: AnuncioLido['fonte']): AnuncioLido {
  const titulo = meta(html, 'og:title') ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
  const descricao = meta(html, 'og:description') ?? meta(html, 'description') ?? '';
  const corpo = htmlToText(html);
  const texto = [titulo, descricao, corpo].filter(Boolean).join('\n').slice(0, MAX_TEXTO);
  return { url, fonte, titulo: decodeEntities(titulo), texto, fotos: extractPhotos(html, url) };
}

function looksBlocked(status: number, html: string): boolean {
  if (status >= 400) return true;
  if (html.length < 3000) return true;
  return /captcha|access denied|attention required|just a moment|verifique se voce e humano|acesso negado/i.test(
    html.slice(0, 20_000)
  );
}

/** fetch que valida cada redirecionamento com assertPublicUrl (o redirect automatico pularia a checagem). */
async function safeFetch(url: URL, headers: Record<string, string>): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    return { res, finalUrl: current.toString() };
  }
  throw new UrlInvalidaError('Redirecionamentos demais.');
}

async function readWithFetch(url: URL): Promise<AnuncioLido | null> {
  try {
    const { res, finalUrl } = await safeFetch(url, {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9'
    });
    const html = await res.text();
    if (looksBlocked(res.status, html)) return null;
    return parsePage(html, finalUrl, 'fetch');
  } catch {
    return null;
  }
}

function proxyFromEnv(): { server: string; username?: string; password?: string } | undefined {
  const host = process.env.PROXY_HOST?.trim();
  const port = (process.env.PROXY_PORT ?? process.env.PROXY_PORTS?.split(',')[0])?.trim();
  if (!host || !port || !process.env.PROXY_USER) return undefined;
  return { server: `http://${host}:${port}`, username: process.env.PROXY_USER, password: process.env.PROXY_PASS };
}

async function readWithBrowser(url: URL): Promise<AnuncioLido | null> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], proxy: proxyFromEnv() });
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage();
    // Bloqueia navegacao para enderecos internos (ex.: redirecionamento para a rede da VPS).
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === 'localhost' || (isIP(host) && isPrivateAddress(host))) return route.abort();
      return route.continue();
    });
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3_000);
    // Rola a pagina para carregar a galeria de fotos.
    await page.mouse.wheel(0, 2_000).catch(() => undefined);
    await page.waitForTimeout(1_500);
    const html = await page.content();
    if (looksBlocked(response?.status() ?? 200, html)) return null;
    return parsePage(html, page.url(), 'navegador');
  } catch (err) {
    console.error('[anuncio-reader] navegador falhou', err instanceof Error ? err.message : err);
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function lerAnuncio(raw: string): Promise<AnuncioLido> {
  const url = await assertPublicUrl(raw);
  const lido = (await readWithFetch(url)) ?? (await readWithBrowser(url));
  if (!lido) {
    throw new AnuncioBloqueadoError(
      'O portal bloqueou a leitura automatica deste anuncio. Cole o texto do anuncio e envie as fotos para analisar.'
    );
  }
  return lido;
}

/** Baixa as fotos e converte para data URL (a OpenAI nem sempre consegue baixar direto das CDNs dos portais). */
export async function baixarFotos(urls: string[], referer: string): Promise<string[]> {
  const results = await Promise.all(
    urls.slice(0, MAX_FOTOS).map(async (foto) => {
      try {
        const { res } = await safeFetch(await assertPublicUrl(foto), {
          'User-Agent': USER_AGENT,
          Referer: referer,
          Accept: 'image/*'
        });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 8_000 || buf.length > MAX_FOTO_BYTES) return null; // ignora icones e arquivos enormes
        return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is string => r !== null);
}
