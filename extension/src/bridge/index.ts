import {
  ORIGEM_EXTENSAO,
  ORIGEM_SITE,
  PORTA_CAPTURA,
  type PedidoCaptura,
  type RespostaCaptura
} from '../shared/messages';

// Roda so no site do caca-carros. Recebe pedidos da pagina via window.postMessage e repassa ao service worker.
// Protocolo:
//   pagina -> { source: 'caca-carros', type: 'AUTOEXPERT_PING', id }
//   pagina -> { source: 'caca-carros', type: 'AUTOEXPERT_CAPTURAR', id, url }
//   ponte  -> { source: 'autoexpert-ext', type: 'AUTOEXPERT_PONG', id, versao }
//   ponte  -> { source: 'autoexpert-ext', type: 'AUTOEXPERT_RESULTADO', id, resultado: RespostaCaptura }

document.documentElement.dataset.autoexpert = chrome.runtime.getManifest().version;

function responder(payload: Record<string, unknown>) {
  window.postMessage({ source: ORIGEM_EXTENSAO, ...payload }, window.location.origin);
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as { source?: string; type?: string; id?: string; url?: unknown };
  if (data?.source !== ORIGEM_SITE || typeof data.id !== 'string') return;

  if (data.type === 'AUTOEXPERT_PING') {
    responder({ type: 'AUTOEXPERT_PONG', id: data.id, versao: chrome.runtime.getManifest().version });
    return;
  }

  if (data.type === 'AUTOEXPERT_CAPTURAR' && typeof data.url === 'string') {
    const id = data.id;
    // Porta (e nao sendMessage) mantem o service worker ativo enquanto a aba carrega.
    const porta = chrome.runtime.connect({ name: PORTA_CAPTURA });
    let respondido = false;
    porta.onMessage.addListener((resultado: RespostaCaptura) => {
      respondido = true;
      responder({ type: 'AUTOEXPERT_RESULTADO', id, resultado });
      porta.disconnect();
    });
    porta.onDisconnect.addListener(() => {
      if (respondido) return;
      const resultado: RespostaCaptura = { type: 'CAPTURA_ERRO', mensagem: 'A extensão foi interrompida. Recarregue a página.' };
      responder({ type: 'AUTOEXPERT_RESULTADO', id, resultado });
    });
    porta.postMessage({ type: 'CAPTURAR_URL', url: data.url } satisfies PedidoCaptura);
  }
});
