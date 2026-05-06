import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WantedCarDTO } from '@caca/shared/types/car';
import { api } from '../services/api';
import { WantedCarDetailsModal } from '../components/WantedCarDetailsModal';

type CreateWantedInput = {
  brand: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  mileageFrom: string;
  mileageTo: string;
  maxPrice: string;
};

const currentYear = new Date().getFullYear();

function createEmptyForm(): CreateWantedInput {
  return {
    brand: '',
    model: '',
    yearFrom: String(currentYear),
    yearTo: String(currentYear),
    mileageFrom: '',
    mileageTo: '',
    maxPrice: ''
  };
}

export function Home() {
  const navigate = useNavigate();
  const [wantedCars, setWantedCars] = useState<WantedCarDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchingWantedId, setSearchingWantedId] = useState<string | null>(null);
  const [selectedWantedId, setSelectedWantedId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateWantedInput>(createEmptyForm());

  const hasToken = useMemo(() => Boolean(localStorage.getItem('token')), []);
  const selectedWantedCar = useMemo(
    () => wantedCars.find((wanted) => wanted.id === selectedWantedId) ?? null,
    [selectedWantedId, wantedCars]
  );

  async function loadWanted() {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.get<WantedCarDTO[]>('/cars/wanted');
      setWantedCars(data);
    } catch {
      setError('Falha ao carregar carros desejados (verifique login).');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasToken) {
      navigate('/login');
      return;
    }
    loadWanted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseOptionalInteger(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  async function createWanted(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const yearFrom = Number(form.yearFrom);
    const yearTo = Number(form.yearTo);
    const maxPrice = Number(form.maxPrice);
    const mileageFrom = parseOptionalInteger(form.mileageFrom);
    const mileageTo = parseOptionalInteger(form.mileageTo);

    if (!form.brand.trim() || !form.model.trim()) {
      setError('Informe marca e modelo.');
      setLoading(false);
      return;
    }

    if (!Number.isInteger(yearFrom) || !Number.isInteger(yearTo) || yearFrom > yearTo) {
      setError('Informe um intervalo de ano válido.');
      setLoading(false);
      return;
    }

    if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
      setError('Informe um preço máximo válido.');
      setLoading(false);
      return;
    }

    const mileageFieldsFilled = Boolean(form.mileageFrom.trim() || form.mileageTo.trim());
    if (mileageFieldsFilled && (mileageFrom === null || mileageTo === null || mileageFrom > mileageTo)) {
      setError('Informe uma faixa de quilometragem válida.');
      setLoading(false);
      return;
    }

    try {
      await api.post('/cars/wanted', {
        brand: form.brand.trim(),
        model: form.model.trim(),
        yearFrom,
        yearTo,
        mileageFrom: mileageFieldsFilled ? mileageFrom : null,
        mileageTo: mileageFieldsFilled ? mileageTo : null,
        maxPrice
      });
      await loadWanted();
      setForm(createEmptyForm());
    } catch {
      setError('Falha ao cadastrar WantedCar.');
    } finally {
      setLoading(false);
    }
  }

  async function manualSearchPending() {
    setError(null);
    setLoading(true);
    try {
      await api.post('/cars/search-external', {});
      await loadWanted();
    } catch {
      setError('Falha ao executar busca manual.');
    } finally {
      setLoading(false);
    }
  }

  async function searchWantedCar(wantedCarId: string) {
    setError(null);
    setSearchingWantedId(wantedCarId);
    try {
      await api.post('/cars/search-external', { wantedCarId });
      await loadWanted();
    } catch {
      setError('Falha ao executar busca para este carro.');
    } finally {
      setSearchingWantedId(null);
    }
  }

  return (
    <div className="container">
      <h1 className="title">Caça Carros</h1>

      <form className="card" onSubmit={createWanted}>
        <h2 style={{ marginTop: 0 }}>Cadastrar carro desejado</h2>

        <div className="row">
          <div className="field">
            <label>Marca</label>
            <input value={form.brand} onChange={(e) => setForm((s) => ({ ...s, brand: e.target.value }))} placeholder="Ex: Toyota" />
          </div>

          <div className="field">
            <label>Modelo</label>
            <input value={form.model} onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))} placeholder="Ex: Corolla" />
          </div>

          <div className="field">
            <label>Ano mínimo</label>
            <input
              type="number"
              value={form.yearFrom}
              onChange={(e) => setForm((s) => ({ ...s, yearFrom: e.target.value }))}
              placeholder="2020"
              inputMode="numeric"
              min="1900"
            />
          </div>

          <div className="field">
            <label>Ano máximo</label>
            <input
              type="number"
              value={form.yearTo}
              onChange={(e) => setForm((s) => ({ ...s, yearTo: e.target.value }))}
              placeholder="2023"
              inputMode="numeric"
              min="1900"
            />
          </div>

          <div className="field">
            <label>KM mínimo</label>
            <input
              type="number"
              value={form.mileageFrom}
              onChange={(e) => setForm((s) => ({ ...s, mileageFrom: e.target.value }))}
              placeholder="50000"
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="field">
            <label>KM máximo</label>
            <input
              type="number"
              value={form.mileageTo}
              onChange={(e) => setForm((s) => ({ ...s, mileageTo: e.target.value }))}
              placeholder="90000"
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="field">
            <label>Preço máximo</label>
            <input
              type="number"
              value={form.maxPrice}
              onChange={(e) => setForm((s) => ({ ...s, maxPrice: e.target.value }))}
              placeholder="80000"
              inputMode="numeric"
              min="1"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={loading} type="submit">Cadastrar</button>
          <button className="secondary" type="button" disabled={loading} onClick={manualSearchPending}>Buscar pendentes agora</button>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="muted" style={{ marginTop: 10 }}>
          Ao cadastrar, o backend tenta buscar imediatamente. Se não achar, fica PENDING e o cron tenta de tempos em tempos.
        </div>
      </form>

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Carros desejados</h2>
        <button className="secondary" disabled={loading} onClick={loadWanted}>{loading ? 'Atualizando...' : 'Atualizar lista'}</button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {wantedCars.map((w) => (
          <div key={w.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{w.brand} {w.model}</div>
                <div className="muted">
                  Ano: {w.yearFrom} a {w.yearTo ?? '—'} • KM: {w.mileageFrom ?? '—'} a {w.mileageTo ?? '—'}
                </div>
                <div className="muted">Max: R$ {Number(w.maxPrice).toLocaleString('pt-BR')} • Status: {w.status}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <button className="secondary" disabled={loading || searchingWantedId === w.id} onClick={() => setSelectedWantedId(w.id)}>
                  Detalhes / buscar
                </button>
              </div>
            </div>
          </div>
        ))}

        {!wantedCars.length && <div className="muted">Nenhum WantedCar cadastrado ainda.</div>}
      </div>

      {selectedWantedCar && (
        <WantedCarDetailsModal
          wantedCar={selectedWantedCar}
          loading={searchingWantedId === selectedWantedCar.id}
          onClose={() => setSelectedWantedId(null)}
          onSearch={() => searchWantedCar(selectedWantedCar.id)}
        />
      )}
    </div>
  );
}
