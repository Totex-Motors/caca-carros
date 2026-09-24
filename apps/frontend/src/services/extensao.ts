// Ponte com a extensao AutoExpert AI (extension/src/bridge): quando instalada, o proprio navegador do usuario abre
// o anuncio numa aba em segundo plano, com o login dele no portal, e devolve texto e fotos. Evita o bloqueio que os
// portais aplicam ao servidor.

const ORIGEM_SITE = 'caca-carros';
const ORIGEM_EXTENSAO = 'autoexpert-ext';

export type CapturaExtensao = {
  url: string;
  portal: string;
  titulo: string;
  texto: string;
  fotos: string[]; // data URLs ja reduzidas pela extensao
};

type Resposta = { source?: string; type?: string; id?: string; [k: string]: unknown };

function chamar(mensagem: Record<string, unknown>, tipoResposta: string, timeoutMs: number): Promise<Resposta | null> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', ouvir);
      resolve(null);
    }, timeoutMs);
    function ouvir(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Resposta;
      if (data?.source !== ORIGEM_EXTENSAO || data.id !== id || data.type !== tipoResposta) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', ouvir);
      resolve(data);
    }
    window.addEventListener('message', ouvir);
    window.postMessage({ source: ORIGEM_SITE, id, ...mensagem }, window.location.origin);
  });
}

/** Versao da extensao instalada, ou null se nao estiver instalada/ativa neste site. */
export async function detectarExtensao(): Promise<string | null> {
  const resposta = await chamar({ type: 'AUTOEXPERT_PING' }, 'AUTOEXPERT_PONG', 800);
  return typeof resposta?.versao === 'string' ? resposta.versao : null;
}

/** Pede para a extensao ler o anuncio no navegador do usuario. Lanca Error com mensagem pronta para exibir. */
export async function capturarComExtensao(url: string): Promise<CapturaExtensao> {
  const resposta = await chamar({ type: 'AUTOEXPERT_CAPTURAR', url }, 'AUTOEXPERT_RESULTADO', 120_000);
  if (!resposta) throw new Error('A extensão não respondeu. Recarregue esta página e tente de novo.');
  const resultado = resposta.resultado as
    | { type: 'CAPTURA_OK'; captura: Omit<CapturaExtensao, 'fotos'> & { fotos: string[] }; fotos: string[] }
    | { type: 'CAPTURA_ERRO'; mensagem: string };
  if (resultado?.type !== 'CAPTURA_OK') {
    throw new Error(resultado?.mensagem ?? 'Não foi possível ler o anúncio no seu navegador.');
  }
  return { ...resultado.captura, fotos: resultado.fotos };
}
