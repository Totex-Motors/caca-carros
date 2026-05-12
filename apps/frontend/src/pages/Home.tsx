import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CarDTO, WantedCarDTO, WantedCarStatus } from '@caca/shared/types/car';
import { api } from '../services/api';
import { WantedCarDetailsModal } from '../components/WantedCarDetailsModal';
import { getFipeBrands, getFipeModels, getFipeYears, type FipeBrand, type FipeModel, type FipeYear } from '../services/fipe';

type CreateWantedInput = {
  brandCode: string;
  modelCode: string;
  yearFromCode: string;
  yearToCode: string;
  mileageFrom: string;
  mileageTo: string;
  maxPrice: string;
};

type FipeYearOption = {
  code: string;
  label: string;
  year: number;
};

type PaginatedCarsResponse = {
  data: CarDTO[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ManualSearchResponse = {
  wantedCarId: string;
  adsFound: number;
  carsSaved: number;
  message: string;
};

const MAX_PRICE_FALLBACK = 2147483647;

function createEmptyForm(): CreateWantedInput {
  return {
    brandCode: '',
    modelCode: '',
    yearFromCode: '',
    yearToCode: '',
    mileageFrom: '',
    mileageTo: '',
    maxPrice: ''
  };
}

function extractYearValue(value: string): number | null {
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : null;
}

function mapFipeYears(years: FipeYear[]): FipeYearOption[] {
  return years
    .map((year) => {
      const extracted = extractYearValue(year.nome) ?? extractYearValue(year.codigo);
      if (!extracted) return null;
      return {
        code: year.codigo,
        label: year.nome,
        year: extracted
      };
    })
    .filter((item): item is FipeYearOption => item !== null);
}

function sanitizeNumberInput(value: string): string {
  return value.replace(/\D/g, '');
}

function formatNumberInput(value: string): string {
  if (!value) return '';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString('pt-BR');
}

function formatMaxPrice(value: number): string {
  if (!Number.isFinite(value) || value >= MAX_PRICE_FALLBACK) return 'Sem limite';
  return `R$ ${value.toLocaleString('pt-BR')}`;
}

function formatStatus(status: WantedCarStatus): string {
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

export function Home() {
  const navigate = useNavigate();
  const [wantedCars, setWantedCars] = useState<WantedCarDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSearchNotice, setAutoSearchNotice] = useState<string | null>(null);
  const [autoSearchLoadingId, setAutoSearchLoadingId] = useState<string | null>(null);
  const [selectedWantedId, setSelectedWantedId] = useState<string | null>(null);
  const [carsPage, setCarsPage] = useState(1);
  const [carsPageSize] = useState(10);
  const [carsTotal, setCarsTotal] = useState(0);
  const [carsData, setCarsData] = useState<CarDTO[]>([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [carsError, setCarsError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [models, setModels] = useState<FipeModel[]>([]);
  const [years, setYears] = useState<FipeYearOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [fipeError, setFipeError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateWantedInput>(createEmptyForm());

  const hasToken = useMemo(() => Boolean(localStorage.getItem('token')), []);
  const selectedWantedCar = useMemo(
    () => wantedCars.find((wanted) => wanted.id === selectedWantedId) ?? null,
    [selectedWantedId, wantedCars]
  );

  const waitingCars = useMemo(
    () => wantedCars.filter((wanted) => wanted.status !== 'BOUGHT' && wanted.status !== 'ARCHIVED'),
    [wantedCars]
  );

  const boughtCars = useMemo(
    () => wantedCars.filter((wanted) => wanted.status === 'BOUGHT'),
    [wantedCars]
  );

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.codigo === form.brandCode) ?? null,
    [brands, form.brandCode]
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.codigo === form.modelCode) ?? null,
    [models, form.modelCode]
  );

  const selectedYearFrom = useMemo(
    () => years.find((year) => year.code === form.yearFromCode) ?? null,
    [years, form.yearFromCode]
  );

  const selectedYearTo = useMemo(
    () => years.find((year) => year.code === form.yearToCode) ?? null,
    [years, form.yearToCode]
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

  async function loadCarsPage(wantedCarId: string, page = 1) {
    setCarsError(null);
    setCarsLoading(true);
    try {
      const { data } = await api.get<PaginatedCarsResponse>(`/cars/wanted/${wantedCarId}/cars`, {
        params: {
          page,
          limit: carsPageSize
        }
      });
      setCarsData(data.data);
      setCarsPage(data.page);
      setCarsTotal(data.total);
    } catch {
      setCarsError('Falha ao carregar anuncios.');
      setCarsData([]);
      setCarsTotal(0);
    } finally {
      setCarsLoading(false);
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

  useEffect(() => {
    if (!selectedWantedId) return;
    loadCarsPage(selectedWantedId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWantedId]);

  useEffect(() => {
    let active = true;

    async function loadBrands() {
      setFipeError(null);
      setBrandsLoading(true);
      try {
        const data = await getFipeBrands();
        if (!active) return;
        setBrands(data);
      } catch {
        if (!active) return;
        setFipeError('Falha ao carregar marcas da Tabela FIPE.');
      } finally {
        if (active) setBrandsLoading(false);
      }
    }

    loadBrands();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!form.brandCode) {
      setModels([]);
      setYears([]);
      return;
    }

    let active = true;
    setFipeError(null);
    setModelsLoading(true);

    getFipeModels(form.brandCode)
      .then((data) => {
        if (!active) return;
        setModels(data);
      })
      .catch(() => {
        if (!active) return;
        setFipeError('Falha ao carregar modelos da Tabela FIPE.');
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.brandCode]);

  useEffect(() => {
    if (!form.brandCode || !form.modelCode) {
      setYears([]);
      return;
    }

    let active = true;
    setFipeError(null);
    setYearsLoading(true);

    getFipeYears(form.brandCode, form.modelCode)
      .then((data) => {
        if (!active) return;
        const mapped = mapFipeYears(data).sort((a, b) => b.year - a.year);
        setYears(mapped);
      })
      .catch(() => {
        if (!active) return;
        setFipeError('Falha ao carregar anos da Tabela FIPE.');
      })
      .finally(() => {
        if (active) setYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.brandCode, form.modelCode]);

  function parseOptionalInteger(value: string): number | null {
    const normalized = sanitizeNumberInput(value);
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) ? parsed : null;
  }

  async function createWanted(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const maxPrice = parseOptionalInteger(form.maxPrice);
    const resolvedMaxPrice = maxPrice !== null && maxPrice > 0 ? maxPrice : null;
    const mileageFrom = parseOptionalInteger(form.mileageFrom);
    const mileageTo = parseOptionalInteger(form.mileageTo);

    if (!selectedBrand || !selectedModel) {
      setError('Selecione marca e modelo.');
      setLoading(false);
      return;
    }

    if (selectedYearFrom && selectedYearTo && selectedYearFrom.year > selectedYearTo.year) {
      setError('O ano minimo nao pode ser maior que o ano maximo.');
      setLoading(false);
      return;
    }

    if (mileageFrom !== null && mileageTo !== null && mileageFrom > mileageTo) {
      setError('O KM minimo nao pode ser maior que o KM maximo.');
      setLoading(false);
      return;
    }

    try {
      await api.post('/cars/wanted', {
        brand: selectedBrand.nome,
        model: selectedModel.nome,
        yearFrom: selectedYearFrom?.year ?? null,
        yearTo: selectedYearTo?.year ?? null,
        mileageFrom: mileageFrom ?? null,
        mileageTo: mileageTo ?? null,
        maxPrice: resolvedMaxPrice
      });
      await loadWanted();
      setForm(createEmptyForm());
    } catch {
      setError('Falha ao cadastrar WantedCar.');
    } finally {
      setLoading(false);
    }
  }

  function handleBrandChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const brandCode = event.target.value;
    setForm((state) => ({
      ...state,
      brandCode,
      modelCode: '',
      yearFromCode: '',
      yearToCode: ''
    }));
    setModels([]);
    setYears([]);
  }

  function handleModelChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const modelCode = event.target.value;
    setForm((state) => ({
      ...state,
      modelCode,
      yearFromCode: '',
      yearToCode: ''
    }));
    setYears([]);
  }

  function openWantedDetails(wantedCarId: string) {
    setSelectedWantedId(wantedCarId);
    setAutoSearchNotice(null);
    setStatusError(null);
    setCarsPage(1);
    setCarsData([]);
    setCarsTotal(0);
    setCarsError(null);
  }

  function closeWantedDetails() {
    setSelectedWantedId(null);
    setAutoSearchNotice(null);
    setStatusError(null);
    setCarsPage(1);
    setCarsData([]);
    setCarsTotal(0);
    setCarsError(null);
  }

  async function handleAutoSearch(wantedCarId: string) {
    if (autoSearchLoadingId === wantedCarId) return;
    setAutoSearchNotice(null);
    setAutoSearchLoadingId(wantedCarId);
    try {
      const { data } = await api.post<ManualSearchResponse>('/cars/search-external', { wantedCarId });
      setAutoSearchNotice(data.message || 'Busca concluida.');
      await loadWanted();
      await loadCarsPage(wantedCarId, 1);
    } catch {
      setAutoSearchNotice('Falha ao buscar anuncios na Webmotors.');
    } finally {
      setAutoSearchLoadingId(null);
    }
  }

  function handleCarsPageChange(page: number) {
    if (!selectedWantedId) return;
    loadCarsPage(selectedWantedId, page);
  }

  async function updateWantedStatus(wantedCarId: string, status: WantedCarStatus): Promise<void> {
    setStatusError(null);
    setStatusUpdatingId(wantedCarId);
    try {
      await api.patch(`/cars/wanted/${wantedCarId}/status`, { status });
      await loadWanted();
      closeWantedDetails();
    } catch {
      setStatusError('Falha ao atualizar status do carro.');
    } finally {
      setStatusUpdatingId(null);
    }
  }

  return (
    <div className="container">
      <h1 className="title">Caça Carros</h1>

      <form className="card" onSubmit={createWanted}>
        <h2 style={{ marginTop: 0 }}>Cadastrar carro desejado</h2>
        <div className="muted" style={{ marginBottom: 12 }}>Campos obrigatorios: Marca e Modelo.</div>

        <div className="row">
          <div className="field">
            <label>Marca *</label>
            <select value={form.brandCode} onChange={handleBrandChange} disabled={loading || brandsLoading || !brands.length}>
              <option value="">{brandsLoading ? 'Carregando marcas...' : 'Selecione a marca'}</option>
              {brands.map((brand) => (
                <option key={brand.codigo} value={brand.codigo}>{brand.nome}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Modelo *</label>
            <select value={form.modelCode} onChange={handleModelChange} disabled={loading || modelsLoading || !form.brandCode}>
              <option value="">
                {form.brandCode ? (modelsLoading ? 'Carregando modelos...' : 'Selecione o modelo') : 'Selecione a marca primeiro'}
              </option>
              {models.map((model) => (
                <option key={model.codigo} value={model.codigo}>{model.nome}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ano mínimo (opcional)</label>
            <select
              value={form.yearFromCode}
              onChange={(e) => setForm((s) => ({ ...s, yearFromCode: e.target.value }))}
              disabled={loading || yearsLoading || !form.modelCode}
            >
              <option value="">
                {form.modelCode ? (yearsLoading ? 'Carregando anos...' : 'Opcional') : 'Selecione o modelo primeiro'}
              </option>
              {years.map((year) => (
                <option key={year.code} value={year.code}>{year.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ano máximo (opcional)</label>
            <select
              value={form.yearToCode}
              onChange={(e) => setForm((s) => ({ ...s, yearToCode: e.target.value }))}
              disabled={loading || yearsLoading || !form.modelCode}
            >
              <option value="">Opcional</option>
              {years.map((year) => (
                <option key={year.code} value={year.code}>{year.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>KM mínimo (opcional)</label>
            <input
              type="text"
              value={formatNumberInput(form.mileageFrom)}
              onChange={(e) => setForm((s) => ({ ...s, mileageFrom: sanitizeNumberInput(e.target.value) }))}
              placeholder="50.000"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label>KM máximo (opcional)</label>
            <input
              type="text"
              value={formatNumberInput(form.mileageTo)}
              onChange={(e) => setForm((s) => ({ ...s, mileageTo: sanitizeNumberInput(e.target.value) }))}
              placeholder="90.000"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label>Preço máximo (opcional)</label>
            <input
              type="text"
              value={formatNumberInput(form.maxPrice)}
              onChange={(e) => setForm((s) => ({ ...s, maxPrice: sanitizeNumberInput(e.target.value) }))}
              placeholder="80.000"
              inputMode="numeric"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={loading} type="submit">Cadastrar</button>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {fipeError && <div className="error" style={{ marginTop: 8 }}>{fipeError}</div>}
        <div className="muted" style={{ marginTop: 10 }}>
          Ao cadastrar, o carro entra na lista sem buscar automaticamente. Use o botao de detalhes para buscar anuncios.
        </div>
      </form>

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Carros em espera</h2>
        <button className="secondary" disabled={loading} onClick={loadWanted}>{loading ? 'Atualizando...' : 'Atualizar lista'}</button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {waitingCars.map((w) => (
          <div key={w.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{w.brand} {w.model}</div>
                <div className="muted">
                  Ano: {w.yearFrom} a {w.yearTo ?? '—'} • KM: {w.mileageFrom ?? '—'} a {w.mileageTo ?? '—'}
                </div>
                <div className="muted">Max: {formatMaxPrice(Number(w.maxPrice))} • Status: {formatStatus(w.status)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <button className="secondary" disabled={loading} onClick={() => openWantedDetails(w.id)}>
                  Detalhes / buscar
                </button>
              </div>
            </div>
          </div>
        ))}

        {!waitingCars.length && <div className="muted">Nenhum carro em espera no momento.</div>}
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Carros comprados</h2>
        <div className="muted">Total: {boughtCars.length}</div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {boughtCars.map((w) => (
          <div key={w.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{w.brand} {w.model}</div>
                <div className="muted">
                  Ano: {w.yearFrom} a {w.yearTo ?? '—'} • KM: {w.mileageFrom ?? '—'} a {w.mileageTo ?? '—'}
                </div>
                <div className="muted">Max: {formatMaxPrice(Number(w.maxPrice))} • Status: {formatStatus(w.status)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <button className="secondary" disabled={loading} onClick={() => openWantedDetails(w.id)}>
                  Detalhes
                </button>
              </div>
            </div>
          </div>
        ))}

        {!boughtCars.length && <div className="muted">Nenhum carro comprado ainda.</div>}
      </div>

      {selectedWantedCar && (
        <WantedCarDetailsModal
          wantedCar={selectedWantedCar}
          cars={carsData}
          carsTotal={carsTotal}
          carsPage={carsPage}
          carsPageSize={carsPageSize}
          carsLoading={carsLoading}
          carsError={carsError}
          autoSearchLoading={autoSearchLoadingId === selectedWantedCar.id}
          autoSearchNotice={autoSearchNotice}
          statusLoading={statusUpdatingId === selectedWantedCar.id}
          statusError={statusError}
          onClose={closeWantedDetails}
          onAutoSearch={() => handleAutoSearch(selectedWantedCar.id)}
          onMarkBought={() => updateWantedStatus(selectedWantedCar.id, 'BOUGHT')}
          onArchive={() => updateWantedStatus(selectedWantedCar.id, 'ARCHIVED')}
          onPageChange={handleCarsPageChange}
        />
      )}
    </div>
  );
}
