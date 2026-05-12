import { useEffect } from 'react';
import type { CarDTO, WantedCarDTO } from '@caca/shared/types/car';
import { CarList } from './CarList';

type WantedCarDetailsModalProps = {
  wantedCar: WantedCarDTO;
  cars: CarDTO[];
  carsTotal: number;
  carsPage: number;
  carsPageSize: number;
  carsLoading: boolean;
  carsError: string | null;
  autoSearchLoading: boolean;
  autoSearchNotice: string | null;
  statusLoading: boolean;
  statusError: string | null;
  onClose: () => void;
  onAutoSearch: () => void;
  onMarkBought: () => void;
  onArchive: () => void;
  onPageChange: (page: number) => void;
};

const MAX_PRICE_FALLBACK = 2147483647;

function formatRange(minValue: number | null, maxValue: number | null, suffix = ''): string {
  if (minValue === null && maxValue === null) return 'Não informado';
  if (minValue !== null && maxValue !== null) return `${minValue.toLocaleString('pt-BR')} a ${maxValue.toLocaleString('pt-BR')}${suffix}`;
  if (minValue !== null) return `A partir de ${minValue.toLocaleString('pt-BR')}${suffix}`;
  return `Até ${maxValue?.toLocaleString('pt-BR')}${suffix}`;
}

function formatMaxPrice(value: number): string {
  if (!Number.isFinite(value) || value >= MAX_PRICE_FALLBACK) return 'Sem limite';
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

function formatStatus(status: WantedCarDTO['status']): string {
  switch (status) {
    case 'PENDING':
      return 'Em espera';
    case 'FOUND':
      return 'Encontrado';
    case 'BOUGHT':
      return 'Comprado';
    case 'ARCHIVED':
      return 'Removido';
    default:
      return status;
  }
}

export function WantedCarDetailsModal({
  wantedCar,
  cars,
  carsTotal,
  carsPage,
  carsPageSize,
  carsLoading,
  carsError,
  autoSearchLoading,
  autoSearchNotice,
  statusLoading,
  statusError,
  onClose,
  onAutoSearch,
  onMarkBought,
  onArchive,
  onPageChange
}: WantedCarDetailsModalProps) {

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const totalPages = carsTotal > 0 ? Math.ceil(carsTotal / carsPageSize) : 0;
  const canGoPrev = carsPage > 1;
  const canGoNext = carsPage < totalPages;
  const isBought = wantedCar.status === 'BOUGHT';

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
            <div className="detail-row"><span>Preço máximo</span><strong>{formatMaxPrice(wantedCar.maxPrice)}</strong></div>
            <div className="detail-row"><span>Status</span><strong>{formatStatus(wantedCar.status)}</strong></div>
            <div className="detail-row"><span>Anúncios encontrados</span><strong>{carsTotal}</strong></div>
            <div className="detail-row"><span>Adicionado em</span><strong>{new Date(wantedCar.createdAt).toLocaleString('pt-BR')}</strong></div>
          </div>

          <div className="modal-panel modal-actions-panel">
            {isBought ? (
              <div>
                <div className="modal-section-title">Ações</div>
                <div className="muted">Carro comprado. Ações desativadas.</div>
              </div>
            ) : (
              <>
                <div>
                  <div className="modal-section-title">Ações</div>
                  <button type="button" disabled={autoSearchLoading} onClick={onAutoSearch}>
                    {autoSearchLoading ? 'Buscando...' : 'Buscar anuncios automaticamente'}
                  </button>
                  <div className="muted">A busca consome creditos da Apify e pode levar alguns segundos.</div>
                  {autoSearchNotice && <div className="muted">{autoSearchNotice}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" disabled={statusLoading} onClick={onMarkBought}>
                    {statusLoading ? 'Atualizando...' : 'Marcar como comprado'}
                  </button>
                  <button type="button" className="secondary" disabled={statusLoading} onClick={onArchive}>
                    {statusLoading ? 'Atualizando...' : 'Remover da lista'}
                  </button>
                </div>
                {statusError && <div className="error" style={{ marginTop: 8 }}>{statusError}</div>}
              </>
            )}
          </div>
        </div>

        <div className="modal-section-title" style={{ marginTop: 20 }}>Anuncios encontrados</div>
        {carsTotal > 0 && (
          <div className="muted">
            Mostrando {cars.length} de {carsTotal} anuncios.
          </div>
        )}
        <div className="modal-results">
          {carsLoading ? (
            <div className="muted">Carregando anuncios...</div>
          ) : (
            <CarList cars={cars} />
          )}
          {carsError && <div className="error" style={{ marginTop: 8 }}>{carsError}</div>}
        </div>
        {carsTotal > carsPageSize && (
          <div className="pagination">
            <button className="secondary" disabled={!canGoPrev || carsLoading} onClick={() => onPageChange(carsPage - 1)}>
              Anterior
            </button>
            <div className="pagination-info">
              Pagina {carsPage} de {totalPages}
            </div>
            <button className="secondary" disabled={!canGoNext || carsLoading} onClick={() => onPageChange(carsPage + 1)}>
              Proxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
