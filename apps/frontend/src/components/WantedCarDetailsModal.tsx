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
  statusLoading: boolean;
  statusError: string | null;
  onClose: () => void;
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

function formatYearRange(yearFrom: number | null, yearTo: number | null): string {
  if (yearFrom !== null && yearFrom <= 1900) return 'Qualquer Ano';
  if (yearFrom !== null && yearTo !== null) return `${yearFrom} a ${yearTo}`;
  if (yearFrom !== null) return `${yearFrom} a —`;
  if (yearTo !== null) return `— a ${yearTo}`;
  return 'Qualquer Ano';
}

function formatMaxPrice(value: number): string {
  if (!Number.isFinite(value) || value >= MAX_PRICE_FALLBACK) return 'Sem limite';
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

function formatCondition(condition: WantedCarDTO['condition']): string {
  switch (condition) {
    case 'NEW': return 'Novo';
    case 'USED': return 'Usado';
    default: return 'Qualquer';
  }
}

function formatSellerType(sellerType: WantedCarDTO['sellerType']): string {
  switch (sellerType) {
    case 'PRIVATE': return 'Particular';
    case 'PROFESSIONAL': return 'Loja / Concessionária';
    default: return 'Qualquer';
  }
}

function formatStatus(status: WantedCarDTO['status']): string {
  switch (status) {
    case 'PENDING': return 'Em espera';
    case 'FOUND': return 'Encontrado';
    case 'BOUGHT': return 'Comprado';
    case 'ARCHIVED': return 'Removido';
    default: return status;
  }
}

function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidMobilePhoneDigits(value: string): boolean {
  return value.length === 11 && value[2] === '9';
}

export function WantedCarDetailsModal({
  wantedCar,
  cars,
  carsTotal,
  carsPage,
  carsPageSize,
  carsLoading,
  carsError,
  statusLoading,
  statusError,
  onClose,
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
    if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    return raw;
  }

  const [mode, setMode] = useState<'vehicle' | 'client'>('vehicle');
  const [clientName, setClientName] = useState<string>(wantedCar.clientName ?? '');
  const [clientPhone, setClientPhone] = useState<string>(wantedCar.clientPhone ?? '');
  const [seller, setSeller] = useState<string>(wantedCar.seller ?? '');
  const [clientPhoneError, setClientPhoneError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [pendingSave, setPendingSave] = useState<boolean>(false);

  useEffect(() => {
    setClientName(wantedCar.clientName ?? '');
    setClientPhone(wantedCar.clientPhone ?? '');
    setSeller(wantedCar.seller ?? '');
    setClientPhoneError(null);
    setIsEditing(false);
    setPendingSave(false);
  }, [wantedCar.clientName, wantedCar.clientPhone, wantedCar.seller]);

  useEffect(() => {
    if (pendingSave && clientSavingId === null) {
      setPendingSave(false);
      setIsEditing(false);
    }
  }, [clientSavingId, pendingSave]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
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
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wanted-car-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Carro desejado</div>
            <h3 id="wanted-car-modal-title" className="modal-title">
              {wantedCar.brand} {wantedCar.model}
            </h3>
          </div>
          <button className="secondary modal-close" type="button" onClick={onClose}
            style={{ borderRadius: 14, height: 38, fontSize: 13 }}>
            ✕ Fechar
          </button>
        </div>

        <div className="tab-group" style={{ marginTop: 16 }}>
          <button
            type="button"
            className={mode !== 'vehicle' ? 'secondary' : ''}
            onClick={() => setMode('vehicle')}
          >
            Veículo
          </button>
          <button
            type="button"
            className={mode !== 'client' ? 'secondary' : ''}
            onClick={() => setMode('client')}
          >
            Cliente
          </button>
        </div>

        <div className="modal-grid">
          <div className="modal-panel">
            {mode === 'vehicle' ? (
              <>
                <div className="modal-section-title">Detalhes cadastrados</div>
                <div className="detail-row"><span>Condição</span><strong>{formatCondition(wantedCar.condition)}</strong></div>
                <div className="detail-row"><span>Anunciante</span><strong>{formatSellerType(wantedCar.sellerType)}</strong></div>
                <div className="detail-row"><span>Versão</span><strong>{wantedCar.version ?? '—'}</strong></div>
                <div className="detail-row"><span>Ano</span><strong>{formatYearRange(wantedCar.yearFrom, wantedCar.yearTo)}</strong></div>
                <div className="detail-row"><span>KM</span><strong>{formatRange(wantedCar.mileageFrom, wantedCar.mileageTo, ' km')}</strong></div>
                <div className="detail-row"><span>Preço máximo</span><strong>{formatMaxPrice(wantedCar.maxPrice)}</strong></div>
                <div className="detail-row"><span>Status</span><strong>{formatStatus(wantedCar.status)}</strong></div>
                <div className="detail-row"><span>Anúncios encontrados</span><strong>{carsTotal}</strong></div>
                <div className="detail-row"><span>Adicionado em</span><strong>{new Date(wantedCar.createdAt).toLocaleString('pt-BR')}</strong></div>
              </>
            ) : (
              <>
                <div className="modal-section-title">Dados do Cliente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="field">
                    <label>Nome do cliente</label>
                    {isEditing ? (
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome completo" />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: clientName ? 'var(--text)' : 'var(--muted)' }}>
                        {clientName || '—'}
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label>Telefone / WhatsApp</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(sanitizePhone(e.target.value))}
                        inputMode="numeric"
                        placeholder="11999999999"
                      />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: clientPhone ? 'var(--text)' : 'var(--muted)' }}>
                        {clientPhone ? formatPhone(clientPhone) : '—'}
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label>Vendedor responsável</label>
                    {isEditing ? (
                      <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Nome do vendedor" />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: seller ? 'var(--text)' : 'var(--muted)' }}>
                        {seller || '—'}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={clientSavingId === wantedCar.id}
                          onClick={() => {
                            if (clientPhone && !isValidMobilePhoneDigits(clientPhone)) {
                              setClientPhoneError('Telefone deve ter 11 dígitos e iniciar com 9 após o DDD.');
                              return;
                            }
                            setClientPhoneError(null);
                            if (onSaveClient) {
                              setPendingSave(true);
                              onSaveClient({
                                clientName: clientName.trim() || null,
                                clientPhone: clientPhone.trim() || null,
                                seller: seller.trim() || null
                              });
                            }
                          }}
                        >
                          {clientSavingId === wantedCar.id ? 'Salvando...' : '✓ Salvar'}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setClientName(wantedCar.clientName ?? '');
                            setClientPhone(wantedCar.clientPhone ?? '');
                            setSeller(wantedCar.seller ?? '');
                            setIsEditing(false);
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setIsEditing(true)}>
                        ✎ Editar dados
                      </button>
                    )}
                  </div>
                  {clientPhoneError && <div className="error" style={{ marginTop: 4 }}>{clientPhoneError}</div>}
                  {clientSaveError && <div className="error" style={{ marginTop: 4 }}>{clientSaveError}</div>}
                </div>
              </>
            )}
          </div>

          <div className="modal-panel modal-actions-panel">
            {isBought ? (
              <div>
                <div className="modal-section-title">Ações</div>
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--accent-light)',
                  borderRadius: 14,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--accent)'
                }}>
                  ✓ Carro comprado
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="modal-section-title">Ações</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    disabled={statusLoading}
                    onClick={onMarkBought}
                    style={{
                      background: 'linear-gradient(145deg, #16a34a, #15803d)',
                      boxShadow: '0 6px 20px rgba(22, 163, 74, 0.35), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.12)'
                    }}
                  >
                    {statusLoading ? 'Atualizando...' : '🏁 Marcar como comprado'}
                  </button>
                  <button type="button" className="secondary" disabled={statusLoading} onClick={onArchive}>
                    {statusLoading ? 'Atualizando...' : '🗑 Remover da lista'}
                  </button>
                </div>
                {statusError && <div className="error" style={{ marginTop: 8 }}>{statusError}</div>}
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="modal-section-title">
            Anúncios encontrados
            {carsTotal > 0 && (
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 999,
                background: 'var(--primary-light)',
                color: 'var(--primary-dark)'
              }}>
                {carsTotal} no total
              </span>
            )}
          </div>

          <div className="modal-results">
            {carsLoading ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 14,
                background: 'linear-gradient(145deg, #f8fdff, #f0f9ff)',
                borderRadius: 18,
                border: '1.5px dashed rgba(8, 145, 178, 0.2)'
              }}>
                Carregando anúncios...
              </div>
            ) : (
              <CarList cars={cars} />
            )}
            {carsError && <div className="error" style={{ marginTop: 8 }}>{carsError}</div>}
          </div>

          {carsTotal > carsPageSize && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={!canGoPrev || carsLoading}
                onClick={() => onPageChange(carsPage - 1)}
                style={{ height: 36, padding: '0 14px', fontSize: 13 }}
              >
                ← Anterior
              </button>
              <div className="pagination-info">
                Página {carsPage} de {totalPages}
              </div>
              <button
                className="secondary"
                disabled={!canGoNext || carsLoading}
                onClick={() => onPageChange(carsPage + 1)}
                style={{ height: 36, padding: '0 14px', fontSize: 13 }}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
