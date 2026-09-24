import type { Captura } from '../shared/messages';

// Captura hibrida do anuncio aberto, feita no navegador do proprio usuario (sem bloqueio de robo):
// 1. Dados estruturados (JSON-LD) e metatags Open Graph, quando o portal publica.
// 2. Texto visivel da pagina (fallback universal: a IA separa preco, km, versao e descricao).
// 3. Fotos grandes da galeria (<img>, srcset e og:image).

const MAX_TEXTO = 12_000;
const MAX_FOTOS = 16; // o service worker aproveita ate 8 depois de baixar

const PORTAIS: { nome: string; host: RegExp; anuncio: (url: URL) => boolean }[] = [
  { nome: 'Webmotors', host: /webmotors\.com\.br$/, anuncio: (u) => u.pathname.startsWith('/comprar/') },
  { nome: 'OLX', host: /olx\.com\.br$/, anuncio: (u) => /\d{8,}\/?$/.test(u.pathname) },
  { nome: 'Mobiauto', host: /mobiauto\.com\.br$/, anuncio: (u) => /\/(comprar|detalhes)\//.test(u.pathname) && /\d{4,}/.test(u.pathname) },
  { nome: 'Mercado Livre', host: /mercadolivre\.com\.br$/, anuncio: (u) => /MLB-?\d{6,}/i.test(u.href) },
  { nome: 'iCarros', host: /icarros\.com\.br$/, anuncio: (u) => /\/(comprar|detalhes)/.test(u.pathname) && /\d{5,}/.test(u.pathname) },
  { nome: 'Kavak', host: /kavak\.com$/, anuncio: (u) => /\/usado\//.test(u.pathname) || /\d{5,}/.test(u.pathname) }
];

function jsonLd(): unknown[] {
  const blocos: unknown[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const data = JSON.parse(el.textContent ?? '');
      blocos.push(...(Array.isArray(data) ? data : [data]));
    } catch {
      // bloco invalido: ignora
    }
  });
  return blocos;
}

function temAnuncioEstruturado(blocos: unknown[]): boolean {
  return blocos.some((b) => {
    const tipo = String((b as { '@type'?: unknown })['@type'] ?? '');
    return /Car|Vehicle|Product|Offer/i.test(tipo);
  });
}

export function detectarPortal(): { nome: string; ehAnuncio: boolean } {
  const url = new URL(location.href);
  const portal = PORTAIS.find((p) => p.host.test(url.hostname));
  const nome = portal?.nome ?? url.hostname;
  return { nome, ehAnuncio: (portal?.anuncio(url) ?? false) || temAnuncioEstruturado(jsonLd()) };
}

function meta(prop: string): string {
  const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
  return el?.getAttribute('content')?.trim() ?? '';
}

function maiorDoSrcset(img: HTMLImageElement): string | null {
  const srcset = img.getAttribute('srcset') ?? img.getAttribute('data-srcset');
  if (!srcset) return null;
  const opcoes = srcset
    .split(',')
    .map((s) => s.trim().split(/\s+/))
    .map(([url, desc]) => ({ url, tamanho: parseInt(desc ?? '0', 10) || 0 }))
    .sort((a, b) => b.tamanho - a.tamanho);
  return opcoes[0]?.url ?? null;
}

function coletarFotos(blocos: unknown[]): string[] {
  const candidatas: string[] = [];
  const og = meta('og:image');
  if (og) candidatas.push(og);

  for (const b of blocos) {
    const imagem = (b as { image?: unknown }).image;
    const lista = Array.isArray(imagem) ? imagem : imagem ? [imagem] : [];
    for (const item of lista) {
      if (typeof item === 'string') candidatas.push(item);
      else if (item && typeof (item as { url?: unknown }).url === 'string') candidatas.push((item as { url: string }).url);
    }
  }

  document.querySelectorAll('img').forEach((img) => {
    const largura = img.naturalWidth || img.width;
    const src = maiorDoSrcset(img) ?? img.currentSrc ?? img.src ?? img.getAttribute('data-src');
    if (!src || src.startsWith('data:')) return;
    // Fotos da galeria sao grandes; ignora icones, logos e miniaturas de outros anuncios.
    if (largura && largura < 300) return;
    if (/logo|icon|sprite|avatar|banner|selo|badge|placeholder/i.test(src)) return;
    candidatas.push(src);
  });

  const vistas = new Set<string>();
  const fotos: string[] = [];
  for (const raw of candidatas) {
    let url: string;
    try {
      url = new URL(raw, location.href).toString();
    } catch {
      continue;
    }
    if (!/^https?:\/\//.test(url)) continue;
    const chave = url.split('?')[0];
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    fotos.push(url);
    if (fotos.length >= MAX_FOTOS) break;
  }
  return fotos;
}

function textoDaPagina(): string {
  // Prioriza o conteudo principal; cai para o body inteiro.
  const principal = document.querySelector('main, [role="main"], article') as HTMLElement | null;
  const alvo = principal && principal.innerText.length > 500 ? principal : document.body;
  return alvo.innerText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function capturarAnuncio(): Captura {
  const blocos = jsonLd();
  const titulo = meta('og:title') || document.title;
  const estruturado = blocos.length > 0 ? `DADOS ESTRUTURADOS: ${JSON.stringify(blocos).slice(0, 3_000)}\n` : '';
  const descricao = meta('og:description');
  return {
    url: location.href,
    portal: detectarPortal().nome,
    titulo,
    texto: `${estruturado}${descricao}\n${textoDaPagina()}`.slice(0, MAX_TEXTO),
    fotos: coletarFotos(blocos)
  };
}
