import { apiUrl, getConfig, setConfig } from '../shared/config';
import {
  PORTA_ANALISE,
  PORTA_CAPTURA,
  type Captura,
  type PedidoAnalise,
  type PedidoCaptura,
  type PedidoCapturaAba,
  type RespostaAnalise,
  type RespostaCaptura
} from '../shared/messages';
import type { Analise } from '../shared/types';

// Service worker: recebe a captura do anuncio, baixa e reduz as fotos e envia para o servidor do caca-carros,
// que chama a OpenAI. A chave da OpenAI nunca fica na extensao; a extensao usa o login do usuario no caca-carros.

const MAX_FOTOS = 8;
const MAX_LADO = 1280;

async function fotoParaDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.size < 8_000) return null; // ignora icones
    const bitmap = await createImageBitmap(blob);
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * escala), Math.round(bitmap.height * escala));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

async function analisar(pedido: PedidoAnalise, enviar: (msg: RespostaAnalise) => void): Promise<void> {
  const config = await getConfig();
  if (!config.token) {
    enviar({ type: 'ERRO', mensagem: 'Entre com seu login do caça-carros no ícone da extensão.', precisaLogin: true });
    return;
  }

  const { captura } = pedido;
  enviar({ type: 'ETAPA', etapa: `Preparando ${Math.min(captura.fotos.length, MAX_FOTOS)} foto(s) do anúncio…` });
  const fotos = (await Promise.all(captura.fotos.slice(0, MAX_FOTOS * 2).map(fotoParaDataUrl)))
    .filter((f): f is string => f !== null)
    .slice(0, MAX_FOTOS);

  enviar({ type: 'ETAPA', etapa: 'Analisando anúncio e fotos com a IA (1 a 3 minutos)…' });
  const res = await fetch(apiUrl(config.apiBase, '/dossie/analise'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({
      url: captura.url,
      texto: `${captura.titulo}\n${captura.texto}`.trim(),
      fotos,
      uf: config.uf
    }),
    signal: AbortSignal.timeout(6 * 60 * 1000)
  });

  if (res.status === 401) {
    await setConfig({ token: null });
    enviar({ type: 'ERRO', mensagem: 'Seu login expirou. Entre de novo no ícone da extensão.', precisaLogin: true });
    return;
  }
  const body = (await res.json().catch(() => null)) as (Analise & { message?: string }) | null;
  if (!res.ok || !body) {
    enviar({ type: 'ERRO', mensagem: body?.message ?? `O servidor respondeu com erro (HTTP ${res.status}).` });
    return;
  }
  enviar({ type: 'RESULTADO', analise: body, fotosEnviadas: fotos });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORTA_ANALISE) return;
  let aberta = true;
  port.onDisconnect.addListener(() => {
    aberta = false;
  });
  const enviar = (msg: RespostaAnalise) => {
    if (aberta) port.postMessage(msg);
  };
  port.onMessage.addListener((msg: PedidoAnalise) => {
    if (msg.type !== 'ANALISAR') return;
    analisar(msg, enviar).catch((err: unknown) => {
      const timeout = err instanceof DOMException && err.name === 'TimeoutError';
      enviar({
        type: 'ERRO',
        mensagem: timeout
          ? 'A análise demorou demais. Tente novamente.'
          : 'Não foi possível falar com o servidor do caça-carros. Confira o endereço nas configurações da extensão.'
      });
    });
  });
});

// ---- Ponte com o site: abrir o anuncio numa aba em segundo plano e ler com o login do proprio usuario ----

function esperarCarregar(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(ouvir);
      reject(new Error('timeout'));
    }, timeoutMs);
    function ouvir(id: number, info: chrome.tabs.OnUpdatedInfo) {
      if (id !== tabId || info.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(ouvir);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(ouvir);
  });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function capturarAba(tabId: number): Promise<Captura> {
  // Portais montam a pagina com JavaScript depois do "complete": tenta algumas vezes ate ter texto e fotos.
  let ultima: Captura | null = null;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    await esperar(tentativa === 0 ? 2_500 : 1_500);
    try {
      const captura = (await chrome.tabs.sendMessage(tabId, { type: 'CAPTURAR_PAGINA' } satisfies PedidoCapturaAba)) as Captura | undefined;
      if (captura) {
        ultima = captura;
        if (captura.texto.length > 800 && captura.fotos.length >= 3) return captura;
      }
    } catch {
      // content script ainda nao carregou
    }
  }
  if (ultima) return ultima;
  throw new Error('sem-content-script');
}

async function capturarUrl(url: string): Promise<RespostaCaptura> {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return { type: 'CAPTURA_ERRO', mensagem: 'Link inválido.' };
  }
  if (alvo.protocol !== 'https:' && alvo.protocol !== 'http:') return { type: 'CAPTURA_ERRO', mensagem: 'Link inválido.' };

  const aba = await chrome.tabs.create({ url: alvo.toString(), active: false });
  if (aba.id === undefined) return { type: 'CAPTURA_ERRO', mensagem: 'Não foi possível abrir o anúncio.' };
  try {
    await esperarCarregar(aba.id, 45_000).catch(() => undefined);
    const captura = await capturarAba(aba.id);
    const fotos = (await Promise.all(captura.fotos.slice(0, MAX_FOTOS * 2).map(fotoParaDataUrl)))
      .filter((f): f is string => f !== null)
      .slice(0, MAX_FOTOS);
    return { type: 'CAPTURA_OK', captura, fotos };
  } catch (err) {
    const semScript = err instanceof Error && err.message === 'sem-content-script';
    return {
      type: 'CAPTURA_ERRO',
      mensagem: semScript
        ? 'A extensão ainda não lê este portal. Abra o anúncio e use "Colar texto" e "Fotos".'
        : 'Não foi possível ler o anúncio no seu navegador.'
    };
  } finally {
    chrome.tabs.remove(aba.id).catch(() => undefined);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORTA_CAPTURA) return;
  port.onMessage.addListener((msg: PedidoCaptura) => {
    if (msg.type !== 'CAPTURAR_URL') return;
    capturarUrl(msg.url)
      .catch((): RespostaCaptura => ({ type: 'CAPTURA_ERRO', mensagem: 'Não foi possível ler o anúncio no seu navegador.' }))
      .then((resposta) => {
        try {
          port.postMessage(resposta);
        } catch {
          // a pagina do caca-carros foi fechada
        }
      });
  });
});
