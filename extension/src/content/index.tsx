import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from '../styles.css?inline';
import { getConfig, DEFAULT_API_BASE } from '../shared/config';
import { PORTA_ANALISE, type PedidoAnalise, type RespostaAnalise } from '../shared/messages';
import { capturarAnuncio, detectarPortal } from './capture';
import { Drawer, type Estado } from './Drawer';

// Injeta o botao flutuante e o painel num Shadow DOM, isolado do CSS do portal.

function App() {
  const [portal, setPortal] = useState(() => detectarPortal());
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: 'pronto' });
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const portaRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    getConfig().then((c) => setApiBase(c.apiBase));
  }, []);

  // Portais sao SPAs: a URL muda sem recarregar. Reavalia se a pagina atual e um anuncio.
  useEffect(() => {
    let ultimaUrl = location.href;
    const id = window.setInterval(() => {
      if (location.href === ultimaUrl) return;
      ultimaUrl = location.href;
      portaRef.current?.disconnect();
      setPortal(detectarPortal());
      setEstado({ fase: 'pronto' });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  function analisar() {
    portaRef.current?.disconnect();
    setEstado({ fase: 'analisando', etapa: 'Lendo o anúncio…' });
    const captura = capturarAnuncio();
    const porta = chrome.runtime.connect({ name: PORTA_ANALISE });
    portaRef.current = porta;
    porta.onMessage.addListener((msg: RespostaAnalise) => {
      if (msg.type === 'ETAPA') setEstado({ fase: 'analisando', etapa: msg.etapa });
      if (msg.type === 'RESULTADO') setEstado({ fase: 'resultado', analise: msg.analise, fotosEnviadas: msg.fotosEnviadas });
      if (msg.type === 'ERRO') setEstado({ fase: 'erro', mensagem: msg.mensagem, precisaLogin: msg.precisaLogin });
      if (msg.type !== 'ETAPA') porta.disconnect();
    });
    porta.postMessage({ type: 'ANALISAR', captura } satisfies PedidoAnalise);
  }

  if (!portal.ehAnuncio) return null;

  return (
    <>
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-[2147483647] flex items-center gap-2 rounded-full bg-gradient-to-r from-brand to-brand-dark px-4 py-3 font-sans text-sm font-extrabold text-white shadow-2xl hover:scale-105"
          title="AutoExpert AI: vistoria deste anúncio"
        >
          🔍 AutoExpert
          {estado.fase === 'analisando' && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
          {estado.fase === 'resultado' && (
            <span className="rounded-full bg-white px-1.5 text-xs text-slate-900">{estado.analise.analise.score_confianca}</span>
          )}
        </button>
      )}
      {aberto && (
        <Drawer portal={portal.nome} estado={estado} apiBase={apiBase} onAnalisar={analisar} onFechar={() => setAberto(false)} />
      )}
    </>
  );
}

const host = document.createElement('div');
host.id = 'autoexpert-ai-root';
document.documentElement.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = styles;
shadow.appendChild(style);
const mount = document.createElement('div');
shadow.appendChild(mount);
createRoot(mount).render(<App />);
