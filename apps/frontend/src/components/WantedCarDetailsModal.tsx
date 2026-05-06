import { useEffect } from 'react';
import type { WantedCarDTO } from '@caca/shared/types/car';
import { CarList } from './CarList';

type WantedCarDetailsModalProps = {
  wantedCar: WantedCarDTO;
  loading: boolean;
  onClose: () => void;
  onSearch: () => void;
};

function formatRange(minValue: number | null, maxValue: number | null, suffix = ''): string {
  if (minValue === null && maxValue === null) return 'Não informado';
  if (minValue !== null && maxValue !== null) return `${minValue.toLocaleString('pt-BR')} a ${maxValue.toLocaleString('pt-BR')}${suffix}`;
  if (minValue !== null) return `A partir de ${minValue.toLocaleString('pt-BR')}${suffix}`;
  return `Até ${maxValue?.toLocaleString('pt-BR')}${suffix}`;
}

export function WantedCarDetailsModal({ wantedCar, loading, onClose, onSearch }: WantedCarDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wanted-car-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Carro desejado</div>
            <h3 id="wanted-car-modal-title" className="modal-title">{wantedCar.brand} {wantedCar.model}</h3>
          </div>
          <button className="secondary modal-close" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="modal-grid">
          <div className="modal-panel">
            <div className="modal-section-title">Detalhes cadastrados</div>
            <div className="detail-row"><span>Ano</span><strong>{formatRange(wantedCar.yearFrom, wantedCar.yearTo)}</strong></div>
            <div className="detail-row"><span>KM</span><strong>{formatRange(wantedCar.mileageFrom, wantedCar.mileageTo, ' km')}</strong></div>
            <div className="detail-row"><span>Preço máximo</span><strong>R$ {wantedCar.maxPrice.toLocaleString('pt-BR')}</strong></div>
            <div className="detail-row"><span>Status</span><strong>{wantedCar.status}</strong></div>
            <div className="detail-row"><span>Anúncios encontrados</span><strong>{wantedCar.cars?.length ?? 0}</strong></div>
            <div className="detail-row"><span>Adicionado em</span><strong>{new Date(wantedCar.createdAt).toLocaleString('pt-BR')}</strong></div>
          </div>

          <div className="modal-panel modal-actions-panel">
            <div className="modal-section-title">Ações</div>
            <button disabled={loading} onClick={onSearch}>
              {loading ? 'Buscando...' : 'Buscar agora'}
            </button>
            <div className="muted">A busca atualiza esta janela com os anúncios novos encontrados para este carro.</div>
          </div>
        </div>

        <div className="modal-section-title" style={{ marginTop: 20 }}>Anúncios encontrados</div>
        <div className="modal-results">
          <CarList cars={wantedCar.cars ?? []} />
        </div>
      </div>
    </div>
  );
}
