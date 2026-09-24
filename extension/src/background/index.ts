import { apiUrl, getConfig, setConfig } from '../shared/config';
import { PORTA_ANALISE, type PedidoAnalise, type RespostaAnalise } from '../shared/messages';
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
