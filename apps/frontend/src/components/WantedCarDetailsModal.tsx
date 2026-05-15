import { useEffect, useState } from 'react';
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
  clientSavingId?: string | null;
  clientSaveError?: string | null;
  onSaveClient?: (patch: { clientName?: string | null; clientPhone?: string | null; seller?: string | null }) => void;
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

function formatCondition(condition: WantedCarDTO['condition']): string {
  switch (condition) {
    case 'NEW':
      return 'Novo';
    case 'USED':
      return 'Usado';
    default:
      return 'Qualquer';
  }
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
  onPageChange,
  clientSavingId,
  clientSaveError,
  onSaveClient
}: WantedCarDetailsModalProps) {
  function formatPhone(raw?: string | null): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    }
    return raw;
  }

  const [mode, setMode] = useState<'vehicle' | 'client'>('vehicle');

  // local state for client form
  const [clientName, setClientName] = useState<string>(wantedCar.clientName ?? '');
  const [clientPhone, setClientPhone] = useState<string>(wantedCar.clientPhone ?? '');
  const [seller, setSeller] = useState<string>(wantedCar.seller ?? '');

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [pendingSave, setPendingSave] = useState<boolean>(false);

  // synchronize when wantedCar changes
  useEffect(() => {
    setClientName(wantedCar.clientName ?? '');
    setClientPhone(wantedCar.clientPhone ?? '');
    setSeller(wantedCar.seller ?? '');
    // when opening modal, start not editing
    setIsEditing(false);
    setPendingSave(false);
  }, [wantedCar.clientName, wantedCar.clientPhone, wantedCar.seller]);

  // detect save completion
  useEffect(() => {
    if (pendingSave && clientSavingId === null) {
      setPendingSave(false);
      setIsEditing(false);
    }
  }, [clientSavingId, pendingSave]);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button type="button" className={mode === 'vehicle' ? '' : 'secondary'} onClick={() => setMode('vehicle')}>Detalhes do Veículo</button>
          <button type="button" className={mode === 'client' ? '' : 'secondary'} onClick={() => setMode('client')}>Detalhes do Cliente</button>
        </div>

        <div className="modal-grid">
          <div className="modal-panel">
            {mode === 'vehicle' ? (
              <>
                <div className="modal-section-title">Detalhes cadastrados</div>
                <div className="detail-row"><span>Condição</span><strong>{formatCondition(wantedCar.condition)}</strong></div>
                <div className="detail-row"><span>Versao</span><strong>{wantedCar.version ?? '—'}</strong></div>
                <div className="detail-row"><span>Ano</span><strong>{formatRange(wantedCar.yearFrom, wantedCar.yearTo)}</strong></div>
                <div className="detail-row"><span>KM</span><strong>{formatRange(wantedCar.mileageFrom, wantedCar.mileageTo, ' km')}</strong></div>
                <div className="detail-row"><span>Preço máximo</span><strong>{formatMaxPrice(wantedCar.maxPrice)}</strong></div>
                <div className="detail-row"><span>Status</span><strong>{formatStatus(wantedCar.status)}</strong></div>
                <div className="detail-row"><span>Anúncios encontrados</span><strong>{carsTotal}</strong></div>
                <div className="detail-row"><span>Adicionado em</span><strong>{new Date(wantedCar.createdAt).toLocaleString('pt-BR')}</strong></div>
              </>
            ) : (
              <>
                <div className="modal-section-title">Detalhes do Cliente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="field">
                    <label>Nome do cliente</label>
                    {isEditing ? (
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} />
                    ) : (
                      <div>{clientName || '—'}</div>
                    )}
                  </div>
                  <div className="field">
                    <label>Telefone / WhatsApp</label>
                    {isEditing ? (
                      <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="numeric" />
                    ) : (
                      <div>{clientPhone ? formatPhone(clientPhone) : '—'}</div>
                    )}
                  </div>
                  <div className="field">
                    <label>Vendedor responsável</label>
                    {isEditing ? (
                      <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} />
                    ) : (
                      <div>{seller || '—'}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isEditing ? (
                      <>
                        <button type="button" disabled={clientSavingId === wantedCar.id} onClick={() => { if (onSaveClient) { setPendingSave(true); onSaveClient({ clientName: clientName.trim() || null, clientPhone: clientPhone.trim() || null, seller: seller.trim() || null }); } }}>
                          {clientSavingId === wantedCar.id ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button type="button" className="secondary" onClick={() => { setClientName(wantedCar.clientName ?? ''); setClientPhone(wantedCar.clientPhone ?? ''); setSeller(wantedCar.seller ?? ''); setIsEditing(false); }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setIsEditing(true)}>
                        Editar
                      </button>
                    )}
                  </div>
                  {clientSaveError && <div className="error" style={{ marginTop: 8 }}>{clientSaveError}</div>}
                </div>
              </>
            )}
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
