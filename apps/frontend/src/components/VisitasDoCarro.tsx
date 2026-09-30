import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '../services/dossie';
import type { Visita } from '../services/dossie-types';
import { CLASSIFICACAO_VISITA, criarVisita, listarVisitas, type NovaVisita } from '../services/visitas';

// Visitas presenciais ligadas a um carro desejado (modo Completo): lista as existentes e cria uma nova.

export function VisitasDoCarro(props: { wantedCarId: string; nova: Omit<NovaVisita, 'wantedCarId'> }) {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarVisitas({ wantedCarId: props.wantedCarId })
      .then((v) => ativo && setVisitas(v))
      .catch(() => ativo && setVisitas([]));
    return () => {
      ativo = false;
    };
  }, [props.wantedCarId]);

  async function nova() {
    setCriando(true);
    setErro(null);
    try {
      const v = await criarVisita({ ...props.nova, wantedCarId: props.wantedCarId });
      navigate(`/visita/${v.id}`);
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não foi possível criar a visita.'));
      setCriando(false);
    }
  }

  return (
    <div>
      <div className="modal-section-title">Visitas ao carro</div>
      {visitas === null ? (
        <div className="muted" style={{ fontSize: 13 }}>Carregando…</div>
      ) : visitas.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Nenhuma visita ainda. Ao ir ver o carro, abra o checklist no celular.</div>
      ) : (
        <div className="vi-lista-resumo" style={{ marginBottom: 8 }}>
          {visitas.map((v) => {
            const c = v.parecer ? CLASSIFICACAO_VISITA[v.parecer.classificacao] : null;
            return (
              <Link key={v.id} to={`/visita/${v.id}`} className="vi-resumo">
                <span>
                  {new Date(v.created_at).toLocaleDateString('pt-BR')}{' '}
                  {v.anuncio_url ? <span className="muted">· anúncio</span> : null}
                </span>
                <span>
                  {v.status === 'concluida' && c ? `${c.icone} ${c.label}` : `⏳ ${v.progresso.respondidos}/${v.progresso.total} respondidos`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <button type="button" className="secondary" disabled={criando} onClick={nova} style={{ width: '100%' }}>
        {criando ? 'Preparando checklist…' : '📋 Nova visita (checklist no celular)'}
      </button>
      {erro && <div className="error" style={{ marginTop: 8 }}>{erro}</div>}
    </div>
  );
}

/** Botao "Vou ver este carro" para um anuncio especifico. */
export function BotaoVisitar(props: { nova: NovaVisita; compacto?: boolean }) {
  const navigate = useNavigate();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      const v = await criarVisita(props.nova);
      navigate(`/visita/${v.id}`);
    } catch (e) {
      setErro(apiErrorMessage(e, 'Não foi possível criar a visita.'));
      setCriando(false);
    }
  }

  if (props.compacto) {
    return (
      <button
        type="button"
        onClick={criar}
        disabled={criando}
        title="Checklist para a visita presencial, com os pontos fracos do modelo e as suspeitas do anúncio"
        style={{
          height: 'auto',
          fontSize: 12,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          boxShadow: '0 3px 10px rgba(22, 163, 74, 0.28)'
        }}
      >
        {criando ? '…' : '📋 Visitar'}
      </button>
    );
  }
  return (
    <div>
      <button type="button" onClick={criar} disabled={criando}>
        {criando ? 'Preparando checklist…' : '📋 Preparar visita a este carro'}
      </button>
      {erro && <div className="error" style={{ marginTop: 8 }}>{erro}</div>}
    </div>
  );
}
