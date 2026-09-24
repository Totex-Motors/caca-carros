import { useEffect, useState } from 'react';
import { DossieView } from './DossieView';
import type { Dossie } from '../services/dossie-types';
import { apiErrorMessage, fetchWantedDossie, readUf } from '../services/dossie';

export function DossieModal(props: { wantedId: string; titulo: string; onClose: () => void }) {
  const { wantedId, onClose } = props;
  const [dossie, setDossie] = useState<Dossie | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchWantedDossie(wantedId, readUf())
      .then((d) => ativo && setDossie(d))
      .catch((e) => ativo && setErro(apiErrorMessage(e, 'Não foi possível gerar o dossiê agora.')));
    return () => {
      ativo = false;
    };
  }, [wantedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={`Dossiê ${props.titulo}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Dossiê técnico</div>
            <h3 className="modal-title">{props.titulo}</h3>
          </div>
          <button className="secondary modal-close" type="button" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {!dossie && !erro && (
          <div className="card loading-steps">
            <div className="spinner" />
            <div>
              <strong>Gerando o dossiê…</strong>
              <div className="dx-muted" style={{ fontSize: 13 }}>Se ainda não estiver no acervo, leva de 1 a 2 minutos.</div>
            </div>
          </div>
        )}
        {erro && <div className="error">{erro}</div>}
        {dossie && <DossieView dossie={dossie} />}
      </div>
    </div>
  );
}
