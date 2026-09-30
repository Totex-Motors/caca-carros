import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { formatRange, GRAVIDADE, ORDEM_GRAVIDADE } from '../components/DossieView';
import { api } from '../services/api';
import { apiErrorMessage, resizePhoto } from '../services/dossie';
import type { AreaChecklist, ItemChecklist, ParecerVisita, RespostaItem, Visita } from '../services/dossie-types';
import { CLASSIFICACAO_VISITA, concluirVisita, obterVisita, reabrirVisita, responderVisita, type RespostaEnvio } from '../services/visitas';

// Checklist de visita presencial: uma tela para usar no celular, na frente do carro. Cada resposta e salva sozinha.

const MAX_FOTOS_ITEM = 3;
const SALVAR_APOS_MS = 700;

const RESPOSTAS: { valor: RespostaItem; label: string; icone: string; classe: string }[] = [
  { valor: 'ok', label: 'OK', icone: '✅', classe: 'ok' },
  { valor: 'problema', label: 'Problema', icone: '⚠️', classe: 'problema' },
  { valor: 'nao_aplica', label: 'Não se aplica', icone: '➖', classe: 'na' }
];

const ORIGEM = {
  modelo: { label: 'Ponto fraco do modelo', classe: 'modelo' },
  anuncio: { label: 'Suspeita do anúncio', classe: 'anuncio' },
  base: null
} as const;

function contar(area: AreaChecklist) {
  const respondidos = area.itens.filter((i) => i.resposta).length;
  const problemas = area.itens.filter((i) => i.resposta === 'problema').length;
  return { respondidos, problemas, total: area.itens.length };
}

function ItemVisita(props: {
  item: ItemChecklist;
  somenteLeitura: boolean;
  onChange: (patch: Partial<Pick<ItemChecklist, 'resposta' | 'observacao' | 'fotos'>>) => void;
}) {
  const { item, somenteLeitura, onChange } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const origem = ORIGEM[item.origem];

  async function adicionarFotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_FOTOS_ITEM - item.fotos.length);
    event.target.value = '';
    setErroFoto(null);
    try {
      const novas = await Promise.all(files.map((f) => resizePhoto(f, 1024)));
      onChange({ fotos: [...item.fotos, ...novas].slice(0, MAX_FOTOS_ITEM) });
    } catch {
      setErroFoto('Não foi possível ler a foto.');
    }
  }

  return (
    <li className={`vi-item ${item.resposta ?? ''}`}>
      <div className="vi-item-head">
        <div>
          {origem && <span className={`vi-origem ${origem.classe}`}>{origem.label}</span>}
          <div className="vi-item-texto">{item.texto}</div>
          <div className="vi-item-dica">{item.dica}</div>
          {item.motivo && <div className="vi-item-motivo">💡 {item.motivo}</div>}
        </div>
      </div>
      <div className="vi-respostas" role="radiogroup" aria-label={item.texto}>
        {RESPOSTAS.map((r) => (
          <button
            key={r.valor}
            type="button"
            className={`vi-resp ${r.classe} ${item.resposta === r.valor ? 'ativa' : ''}`}
            aria-pressed={item.resposta === r.valor}
            disabled={somenteLeitura}
            onClick={() => onChange({ resposta: item.resposta === r.valor ? null : r.valor })}
          >
            {r.icone} {r.label}
          </button>
        ))}
      </div>
      {(item.resposta === 'problema' || item.observacao || item.fotos.length > 0) && (
        <div className="vi-detalhe">
          <textarea
            className="consulta-texto vi-obs"
            placeholder="O que você viu? Onde? (ex.: porta traseira esquerda com tinta na borracha)"
            value={item.observacao}
            maxLength={1000}
            readOnly={somenteLeitura}
            onChange={(e) => onChange({ observacao: e.target.value })}
          />
          <div className="photo-strip">
            {item.fotos.map((foto, i) => (
              <div key={foto.slice(-32) + i} className="photo-thumb">
                <img src={foto} alt={`Foto ${i + 1}`} />
                {!somenteLeitura && (
                  <button type="button" className="secondary" aria-label="Remover foto" onClick={() => onChange({ fotos: item.fotos.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                )}
              </div>
            ))}
            {!somenteLeitura && item.fotos.length < MAX_FOTOS_ITEM && (
              <button type="button" className="secondary vi-foto-btn" onClick={() => fileRef.current?.click()}>
                📷 Foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={adicionarFotos} />
          </div>
          {erroFoto && <div className="error" style={{ marginTop: 6 }}>{erroFoto}</div>}
        </div>
      )}
    </li>
  );
}

function Parecer({ parecer }: { parecer: ParecerVisita }) {
  const c = CLASSIFICACAO_VISITA[parecer.classificacao];
  const apontamentos = [...parecer.apontamentos].sort((a, b) => ORDEM_GRAVIDADE.indexOf(a.gravidade) - ORDEM_GRAVIDADE.indexOf(b.gravidade));
  return (
    <div className="dx">
      <div className={`dx-verdict ${c.tone}`}>
        {c.icone} {c.label}
        <small>{parecer.resumo}</small>
      </div>
      <div className="card">
        <h3 className="dx-section-title">Apontamentos ({apontamentos.length})</h3>
        {apontamentos.length === 0 && <p className="dx-p dx-muted">Nenhum problema registrado na visita.</p>}
        {apontamentos.map((a, i) => (
          <div key={i} className={`dx-alert ${a.gravidade}`}>
            <div className="dx-chips" style={{ marginTop: 0, marginBottom: 6 }}>
              <span className={`dx-chip ${GRAVIDADE[a.gravidade].tone}`}>{GRAVIDADE[a.gravidade].label}</span>
              <span className="dx-chip">{a.area}</span>
              {a.custo_estimado_brl.max > 0 && <span className="dx-chip info">{formatRange(a.custo_estimado_brl)}</span>}
            </div>
            <strong>{a.item}</strong>
            <p className="dx-p">{a.descricao}</p>
            <p className="dx-p"><span className="dx-muted">O que fazer:</span> {a.recomendacao}</p>
          </div>
        ))}
      </div>
      <div className="dx-grid-2">
        <div className="card">
          <h3 className="dx-section-title">Negociação</h3>
          <p className="dx-p">{parecer.negociacao}</p>
        </div>
        <div className="card">
          <h3 className="dx-section-title">Próximos passos</h3>
          <ol className="dx-bullets">{parecer.proximos_passos.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      </div>
      {parecer.nao_verificados_relevantes.length > 0 && (
        <div className="dx-note">
          <span>👁️</span>
          <span><strong>Ficou sem ver:</strong> {parecer.nao_verificados_relevantes.join('; ')}.</span>
        </div>
      )}
    </div>
  );
}

export function VisitaPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<'idle' | 'pendente' | 'salvando' | 'salvo' | 'erro'>('idle');
  const [concluindo, setConcluindo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const pendentes = useRef(new Map<string, RespostaEnvio>());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    obterVisita(id)
      .then((v) => {
        setVisita(v);
        const primeira = v.checklist.areas.find((a) => a.itens.some((i) => !i.resposta)) ?? v.checklist.areas[0];
        setAberta(primeira?.id ?? null);
      })
      .catch((e) => setErro(apiErrorMessage(e, 'Visita não encontrada.')));
  }, [id]);

  const enviarPendentes = useCallback(async () => {
    if (pendentes.current.size === 0) return;
    const lote = Array.from(pendentes.current.values());
    pendentes.current.clear();
    setSalvando('salvando');
    try {
      const v = await responderVisita(id, lote);
      // Mantem o que o usuario digitou depois do envio (o servidor devolve o estado salvo).
      setVisita((atual) => (atual ? { ...v, checklist: pendentes.current.size ? atual.checklist : v.checklist } : v));
      setSalvando('salvo');
    } catch (e) {
      for (const r of lote) pendentes.current.set(r.item, { ...r, ...pendentes.current.get(r.item) });
      setSalvando('erro');
      setErro(apiErrorMessage(e, 'Não foi possível salvar. Verifique a conexão.'));
    }
  }, [id]);

  // Antes de sair da pagina, tenta salvar o que ficou pendente (fetch keepalive sobrevive ao fechamento da aba).
  useEffect(() => {
    const flush = () => {
      if (pendentes.current.size === 0) return;
      const token = localStorage.getItem('token');
      fetch(`${api.defaults.baseURL}/visitas/${id}/respostas`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ respostas: Array.from(pendentes.current.values()) })
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [id]);

  function alterarItem(itemId: string, patch: Partial<Pick<ItemChecklist, 'resposta' | 'observacao' | 'fotos'>>) {
    setVisita((atual) => {
      if (!atual) return atual;
      const areas = atual.checklist.areas.map((a) => ({ ...a, itens: a.itens.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
      return { ...atual, checklist: { ...atual.checklist, areas } };
    });
    pendentes.current.set(itemId, { ...pendentes.current.get(itemId), item: itemId, ...patch });
    setSalvando('pendente');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(enviarPendentes, SALVAR_APOS_MS);
  }

  async function concluir() {
    if (!visita) return;
    const { respondidos, total } = progressoDe(visita);
    if (respondidos < total && !window.confirm(`${total - respondidos} itens ficaram sem resposta. Concluir mesmo assim?`)) return;
    setConcluindo(true);
    setErro(null);
    try {
      window.clearTimeout(timer.current);
      await enviarPendentes();
      setVisita(await concluirVisita(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não foi possível gerar o parecer agora.'));
    } finally {
      setConcluindo(false);
    }
  }

  async function reabrir() {
    setErro(null);
    try {
      setVisita(await reabrirVisita(id));
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não foi possível reabrir.'));
    }
  }

  const progresso = useMemo(() => (visita ? progressoDe(visita) : { respondidos: 0, total: 0, problemas: 0 }), [visita]);

  if (erro && !visita) {
    return (
      <div className="container">
        <TopNav />
        <div className="error">{erro}</div>
        <Link to="/" className="dx-chip info" style={{ marginTop: 12, display: 'inline-flex' }}>← Voltar</Link>
      </div>
    );
  }
  if (!visita) {
    return (
      <div className="container">
        <TopNav />
        <div className="card loading-steps"><div className="spinner" /><strong>Abrindo a visita…</strong></div>
      </div>
    );
  }

  const concluida = visita.status === 'concluida';
  const v = visita.veiculo;
  const pct = progresso.total ? Math.round((progresso.respondidos / progresso.total) * 100) : 0;

  return (
    <div className="container vi-container">
      <TopNav />
      <div className="app-header vi-header">
        <div>
          <h1 className="title" style={{ fontSize: '1.6rem' }}>Visita · {v.marca} {v.modelo} {v.ano}</h1>
          <p className="app-subtitle" style={{ margin: 0 }}>
            {v.versao ? `${v.versao} · ` : ''}
            {concluida ? 'Visita concluída.' : 'Responda na frente do carro. Tudo é salvo sozinho.'}
            {visita.anuncio_url && <> · <a href={visita.anuncio_url} target="_blank" rel="noreferrer">anúncio ↗</a></>}
          </p>
        </div>
        <div className="vi-progresso" aria-label={`${pct}% respondido`}>
          <div className="vi-barra"><div style={{ width: `${pct}%` }} /></div>
          <span>{progresso.respondidos}/{progresso.total} · {progresso.problemas} problema(s)</span>
        </div>
      </div>

      {erro && <div className="error" style={{ marginBottom: 12 }}>{erro}</div>}

      {concluida && visita.parecer && <Parecer parecer={visita.parecer} />}

      {visita.checklist.perguntas_ao_vendedor.length > 0 && !concluida && (
        <details className="card vi-area" open={false}>
          <summary className="vi-area-head">
            <span className="vi-area-titulo">🗣️ Perguntas para o vendedor</span>
            <span className="vi-area-conta">{visita.checklist.perguntas_ao_vendedor.length}</span>
          </summary>
          <ol className="dx-bullets" style={{ marginTop: 10 }}>{visita.checklist.perguntas_ao_vendedor.map((p) => <li key={p}>{p}</li>)}</ol>
        </details>
      )}

      {concluida && <h2 className="section-title" style={{ marginTop: 16 }}>Checklist respondido</h2>}

      {visita.checklist.areas.map((area) => {
        const c = contar(area);
        const open = aberta === area.id;
        return (
          <details key={area.id} className={`card vi-area ${c.problemas ? 'com-problema' : c.respondidos === c.total ? 'completa' : ''}`} open={open} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setAberta(area.id)}>
            <summary className="vi-area-head">
              <span className="vi-area-titulo">{area.icone} {area.titulo}</span>
              <span className="vi-area-conta">
                {c.problemas > 0 && <span className="vi-conta-problema">⚠️ {c.problemas}</span>}
                {c.respondidos}/{c.total}
              </span>
            </summary>
            <p className="vi-area-intro">{area.intro}</p>
            <ul className="vi-lista">
              {area.itens.map((item) => (
                <ItemVisita key={item.id} item={item} somenteLeitura={concluida} onChange={(patch) => alterarItem(item.id, patch)} />
              ))}
            </ul>
          </details>
        );
      })}

      <div className="vi-rodape">
        <span className={`vi-salvo ${salvando}`}>
          {salvando === 'salvando' ? '💾 Salvando…' : salvando === 'pendente' ? '… alterações pendentes' : salvando === 'salvo' ? '✓ Salvo' : salvando === 'erro' ? '⚠️ Não salvou' : ''}
        </span>
        {concluida ? (
          <button type="button" className="secondary" onClick={reabrir}>Reabrir visita</button>
        ) : (
          <button type="button" onClick={concluir} disabled={concluindo || progresso.respondidos === 0}>
            {concluindo ? 'Gerando parecer…' : '📝 Concluir e gerar parecer'}
          </button>
        )}
      </div>
    </div>
  );
}

function progressoDe(v: Visita) {
  let total = 0;
  let respondidos = 0;
  let problemas = 0;
  for (const a of v.checklist.areas) {
    for (const i of a.itens) {
      total += 1;
      if (i.resposta) respondidos += 1;
      if (i.resposta === 'problema') problemas += 1;
    }
  }
  return { total, respondidos, problemas };
}
