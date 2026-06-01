import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CarDTO, WantedCarCondition, WantedCarDTO, WantedCarSellerType, WantedCarStatus } from '@caca/shared/types/car';
import { api } from '../services/api';
import { WantedCarDetailsModal } from '../components/WantedCarDetailsModal';
import { getFipeBrands, getFipeModels, getFipeYears, type FipeBrand, type FipeModel, type FipeYear } from '../services/fipe';

type WantedCarView = WantedCarDTO & { version: string | null };

type CreateWantedInput = {
  brandCode: string;
  baseModelName: string;
  variantCode: string;
  version: string;
  condition: WantedCarCondition | '';
  sellerType: WantedCarSellerType | '';
  yearFromCode: string;
  yearToCode: string;
  mileageFrom: string;
  mileageTo: string;
  maxPrice: string;
  clientName: string;
  clientPhone: string;
  seller: string;
};

type FipeYearOption = {
  code: string;
  label: string;
  year: number;
};

type ParsedVariant = {
  code: string;
  label: string;
  version: string | null;
};

type ParsedModelGroup = {
  baseName: string;
  variants: ParsedVariant[];
};

type PaginatedCarsResponse = {
  data: CarDTO[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SearchScheduleResponse = {
  enabled: boolean;
  cron: string;
  timezone: string;
  nextRunAt: string | null;
};

type SearchWantedResponse = {
  wantedCarId: string;
  adsFound: number;
  carsSaved: number;
  message: string;
};

const MAX_PRICE_FALLBACK = 2147483647;

function createEmptyForm(): CreateWantedInput {
  return {
    brandCode: '',
    baseModelName: '',
    variantCode: '',
    version: '',
    condition: '',
    sellerType: '',
    yearFromCode: '',
    yearToCode: '',
    mileageFrom: '',
    mileageTo: '',
    maxPrice: '',
    clientName: '',
    clientPhone: '',
    seller: ''
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

function isValidMobilePhoneDigits(value: string): boolean {
  return value.length === 11 && value[2] === '9';
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

function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return 'Indisponivel';
  return new Date(nextRunAt).toLocaleString('pt-BR');
}

function formatCountdown(nextRunAt: string | null, now: number): string {
  if (!nextRunAt) return 'sem agenda';

  const diffMs = new Date(nextRunAt).getTime() - now;
  if (diffMs <= 0) return 'em instantes';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return `em ${parts.join(' ')}`;
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

function formatCondition(condition: WantedCarCondition | null): string {
  switch (condition) {
    case 'NEW':
      return 'Novo';
    case 'USED':
      return 'Usado';
    default:
      return 'Qualquer';
  }
}

function formatSellerType(sellerType: WantedCarSellerType | null | undefined): string {
  switch (sellerType) {
    case 'PRIVATE':
      return 'Particular';
    case 'PROFESSIONAL':
      return 'Loja / Concessionária';
    default:
      return 'Qualquer';
  }
}

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

function formatYearRange(yearFrom: number | null, yearTo: number | null): string {
  if (yearFrom !== null && yearFrom <= 1900) return 'Qualquer Ano';
  if (yearFrom !== null && yearTo !== null) return `${yearFrom} a ${yearTo}`;
  if (yearFrom !== null) return `${yearFrom} a —`;
  if (yearTo !== null) return `— a ${yearTo}`;
  return 'Qualquer Ano';
}

const FIPE_TRIM_MARKERS = new Set([
  'xrx', 'xre', 'xlt', 'xle', 'xse', 'xrs', 'xr', 'xs', 'xl', 'xe',
  'gli', 'gts', 'gt', 'gti', 'ltd', 'ltz', 'lt', 'le', 'se', 'ex', 'exl', 'lx', 'lxs', 'ls',
  'sl', 'sv', 'sx', 'at', 'aut', 'auto', 'automatico', 'automatica', 'mt', 'cvt', 'dct', 'dsg', 'awd',
  'tsi', 'tfsi', 'mpi', 'tdi', 'tb',
  'sense', 'advance', 'exclusive', 'way', 'sport', 'premium', 'touring', 'limited',
  'comfortline', 'highline', 'trendline', 'sportline', 'trailhawk', 'longitude',
  'turbo', 'flex', 'gasolina', 'diesel', 'hibrido', 'hibrida', 'hybrid',
  'eletrico', 'eletrica', 'electric', 'phev', 'hev', 'ev'
]);

function normalizeFipeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function isFipeVersionStart(token: string, idx: number): boolean {
  if (idx === 0) return false;
  const n = normalizeFipeToken(token);
  if (FIPE_TRIM_MARKERS.has(n)) return true;
  if (/^\d+[.,]\d+$/.test(token)) return true;
  if (/^\d+v$/i.test(token)) return true;
  if (/^v\d+$/i.test(token)) return true;
  if (/^\d+x\d+$/i.test(token)) return true;
  if (/^\d+(?:cv|hp)$/i.test(token)) return true;
  return false;
}

function splitFipeModelName(nome: string): { baseName: string; version: string | null } {
  const tokens = nome.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  for (let i = 1; i < tokens.length; i++) {
    if (isFipeVersionStart(tokens[i], i)) {
      return { baseName: tokens.slice(0, i).join(' '), version: tokens.slice(i).join(' ') };
    }
  }
  return { baseName: tokens.join(' '), version: null };
}

function groupFipeModelsByBase(fipeModels: FipeModel[]): ParsedModelGroup[] {
  const groups = new Map<string, ParsedModelGroup>();
  for (const fipeModel of fipeModels) {
    const { baseName, version } = splitFipeModelName(fipeModel.nome);
    const key = baseName.toUpperCase();
    if (!groups.has(key)) {
      groups.set(key, { baseName, variants: [] });
    }
    groups.get(key)!.variants.push({ code: fipeModel.codigo, label: fipeModel.nome, version });
  }
  return Array.from(groups.values());
}

export function Home() {
  const navigate = useNavigate();
  const [wantedCars, setWantedCars] = useState<WantedCarDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWantedId, setSelectedWantedId] = useState<string | null>(null);
  const [carsPage, setCarsPage] = useState(1);
  const [carsPageSize] = useState(10);
  const [carsTotal, setCarsTotal] = useState(0);
  const [carsData, setCarsData] = useState<CarDTO[]>([]);
  const [carsLoading, setCarsLoading] = useState(false);
  const [carsError, setCarsError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [clientSavingId, setClientSavingId] = useState<string | null>(null);
  const [clientSaveError, setClientSaveError] = useState<string | null>(null);
  const [brands, setBrands] = useState<FipeBrand[]>([]);
  const [models, setModels] = useState<FipeModel[]>([]);
  const [years, setYears] = useState<FipeYearOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [fipeError, setFipeError] = useState<string | null>(null);
  const [searchSchedule, setSearchSchedule] = useState<SearchScheduleResponse | null>(null);
  const [searchScheduleError, setSearchScheduleError] = useState<string | null>(null);
  const [searchingWantedId, setSearchingWantedId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [form, setForm] = useState<CreateWantedInput>(createEmptyForm());

  const hasToken = Boolean(localStorage.getItem('token'));
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

  const parsedGroups = useMemo(() => groupFipeModelsByBase(models), [models]);

  const selectedGroup = useMemo(
    () => parsedGroups.find((g) => g.baseName === form.baseModelName) ?? null,
    [parsedGroups, form.baseModelName]
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
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      setError('Falha ao carregar carros desejados (verifique login).');
    } finally {
      setLoading(false);
    }
  }

  async function loadSearchSchedule() {
    setSearchScheduleError(null);
    try {
      const { data } = await api.get<SearchScheduleResponse>('/cars/search-schedule');
      setSearchSchedule(data);
    } catch {
      setSearchScheduleError('Falha ao carregar agenda de busca automatica.');
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
    loadSearchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
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
    if (!form.brandCode || !form.variantCode) {
      setYears([]);
      return;
    }

    let active = true;
    setFipeError(null);
    setYearsLoading(true);

    getFipeYears(form.brandCode, form.variantCode)
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
  }, [form.brandCode, form.variantCode]);

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
    const resolvedVersion = form.version.trim();
    const version = resolvedVersion.length > 0 ? resolvedVersion : null;

    if (!selectedBrand || !form.baseModelName) {
      setError('Selecione marca e modelo.');
      setLoading(false);
      return;
    }

    if (form.clientPhone && !isValidMobilePhoneDigits(form.clientPhone)) {
      setError('Telefone deve ter 11 digitos e iniciar com 9 apos o DDD.');
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
        model: form.baseModelName,
        version,
        clientName: form.clientName?.trim() || null,
        clientPhone: form.clientPhone?.trim() || null,
        seller: form.seller?.trim() || null,
        sellerType: form.sellerType || null,
        condition: form.condition || null,
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
      baseModelName: '',
      variantCode: '',
      version: '',
      condition: state.condition,
      yearFromCode: '',
      yearToCode: ''
    }));
    setModels([]);
    setYears([]);
  }

  function handleGroupChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const baseModelName = event.target.value;
    setForm((state) => ({
      ...state,
      baseModelName,
      variantCode: '',
      version: '',
      yearFromCode: '',
      yearToCode: ''
    }));
    setYears([]);
  }

  function handleVariantChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const variantCode = event.target.value;
    const variant = selectedGroup?.variants.find((v) => v.code === variantCode) ?? null;
    setForm((state) => ({
      ...state,
      variantCode,
      version: variant?.version ?? '',
      yearFromCode: '',
      yearToCode: ''
    }));
    setYears([]);
  }

  function openWantedDetails(wantedCarId: string) {
    setSelectedWantedId(wantedCarId);
    setStatusError(null);
    setCarsPage(1);
    setCarsData([]);
    setCarsTotal(0);
    setCarsError(null);
  }

  function closeWantedDetails() {
    setSelectedWantedId(null);
    setStatusError(null);
    setCarsPage(1);
    setCarsData([]);
    setCarsTotal(0);
    setCarsError(null);
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

  async function updateWantedDetails(wantedCarId: string, patch: { clientName?: string | null; clientPhone?: string | null; seller?: string | null }): Promise<void> {
    setClientSaveError(null);
    setClientSavingId(wantedCarId);
    try {
      await api.patch(`/cars/wanted/${wantedCarId}`, patch);
      await loadWanted();
      await loadCarsPage(wantedCarId, 1);
    } catch {
      setClientSaveError('Falha ao salvar dados do cliente.');
    } finally {
      setClientSavingId(null);
    }
  }

  async function searchWantedCar(wantedCarId: string): Promise<void> {
    setSearchError(null);
    setSearchingWantedId(wantedCarId);

    try {
      await api.post<SearchWantedResponse>('/cars/search', { wantedCarId });
      await loadWanted();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSearchError(message ?? 'Falha ao buscar o carro agora.');
    } finally {
      setSearchingWantedId(null);
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
            <select value={form.baseModelName} onChange={handleGroupChange} disabled={loading || modelsLoading || !form.brandCode}>
              <option value="">
                {form.brandCode ? (modelsLoading ? 'Carregando modelos...' : 'Selecione o modelo') : 'Selecione a marca primeiro'}
              </option>
              {parsedGroups.map((group) => (
                <option key={group.baseName} value={group.baseName}>{group.baseName}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Versão (opcional)</label>
            <select value={form.variantCode} onChange={handleVariantChange} disabled={loading || !form.baseModelName}>
              <option value="">{form.baseModelName ? 'Qualquer versão' : 'Selecione o modelo primeiro'}</option>
              {(selectedGroup?.variants ?? []).map((variant) => (
                <option key={variant.code} value={variant.code}>
                  {variant.version ?? variant.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Condição (opcional)</label>
            <select
              value={form.condition}
              onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value as WantedCarCondition | '' }))}
              disabled={loading}
            >
              <option value="">Qualquer</option>
              <option value="NEW">Novo</option>
              <option value="USED">Usado</option>
            </select>
          </div>

          <div className="field">
            <label>Anunciante (opcional)</label>
            <select
              value={form.sellerType}
              onChange={(e) => setForm((s) => ({ ...s, sellerType: e.target.value as WantedCarSellerType | '' }))}
              disabled={loading}
            >
              <option value="">Qualquer</option>
              <option value="PRIVATE">Particular</option>
              <option value="PROFESSIONAL">Loja / Concessionária</option>
            </select>
          </div>

          <div className="field">
            <label>Ano mínimo (opcional)</label>
            <select
              value={form.yearFromCode}
              onChange={(e) => setForm((s) => ({ ...s, yearFromCode: e.target.value }))}
              disabled={loading || yearsLoading || !form.variantCode}
            >
              <option value="">
                {form.variantCode ? (yearsLoading ? 'Carregando anos...' : 'Opcional') : 'Selecione a versão primeiro'}
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
              disabled={loading || yearsLoading || !form.variantCode}
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
          <div className="field">
            <label>Cliente (opcional)</label>
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setForm((s) => ({ ...s, clientName: e.target.value }))}
              placeholder="Nome do cliente"
            />
          </div>

          <div className="field">
            <label>Telefone/WhatsApp (opcional)</label>
            <input
              type="text"
              value={form.clientPhone}
              onChange={(e) => setForm((s) => ({ ...s, clientPhone: sanitizeNumberInput(e.target.value) }))}
              placeholder="11999999999"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label>Vendedor (opcional)</label>
            <input
              type="text"
              value={form.seller}
              onChange={(e) => setForm((s) => ({ ...s, seller: e.target.value }))}
              placeholder="Nome do vendedor"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button disabled={loading} type="submit">Cadastrar</button>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {fipeError && <div className="error" style={{ marginTop: 8 }}>{fipeError}</div>}
        <div className="muted" style={{ marginTop: 10 }}>
          Ao cadastrar, o carro entra na lista e a busca automatica roda via cron a cada 12h (configuravel).
        </div>
      </form>

      <div className="divider" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Carros em espera</h2>
        <button className="secondary" disabled={loading} onClick={loadWanted}>{loading ? 'Atualizando...' : 'Atualizar lista'}</button>
      </div>

      {searchScheduleError && <div className="error" style={{ marginTop: 12 }}>{searchScheduleError}</div>}
      {searchError && <div className="error" style={{ marginTop: 12 }}>{searchError}</div>}

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {waitingCars.map((w) => (
          <div key={w.id} className={w.status === 'FOUND' ? 'card card-found' : 'card'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{w.brand} {w.model}</div>
                <div className="muted">
                  Condição: {formatCondition(w.condition)} • Ano: {formatYearRange(w.yearFrom, w.yearTo)} • KM: {w.mileageFrom ?? '—'} a {w.mileageTo ?? '—'}
                </div>
                {w.version && <div className="muted">Versao: {w.version}</div>}
                {w.sellerType && <div className="muted">Anunciante: {formatSellerType(w.sellerType)}</div>}
                <div className="muted">Max: {formatMaxPrice(Number(w.maxPrice))} • Status: {formatStatus(w.status)}</div>
                {w.clientName && <div style={{ marginTop: 6 }}><strong>Cliente:</strong> {w.clientName}</div>}
                {w.clientPhone && <div className="muted">{formatPhone(w.clientPhone)}</div>}
                {w.seller && <div className="muted">Vendedor: {w.seller}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <button
                  disabled={loading || searchingWantedId === w.id || !searchSchedule?.enabled || w.status !== 'PENDING'}
                  onClick={() => searchWantedCar(w.id)}
                >
                  {searchingWantedId === w.id
                    ? 'Buscando...'
                    : w.status === 'PENDING'
                      ? `Buscar carro ${searchSchedule?.nextRunAt ? `• ${formatCountdown(searchSchedule.nextRunAt, now)}` : ''}`
                      : 'Busca encerrada'}
                </button>
                <button className="secondary" disabled={loading} onClick={() => openWantedDetails(w.id)}>
                  Detalhes
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
                  Condição: {formatCondition(w.condition)} • Ano: {formatYearRange(w.yearFrom, w.yearTo)} • KM: {w.mileageFrom ?? '—'} a {w.mileageTo ?? '—'}
                </div>
                {w.version && <div className="muted">Versao: {w.version}</div>}
                {w.sellerType && <div className="muted">Anunciante: {formatSellerType(w.sellerType)}</div>}
                <div className="muted">Max: {formatMaxPrice(Number(w.maxPrice))} • Status: {formatStatus(w.status)}</div>
                {w.clientName && <div style={{ marginTop: 6 }}><strong>Cliente:</strong> {w.clientName}</div>}
                {w.clientPhone && <div className="muted">{formatPhone(w.clientPhone)}</div>}
                {w.seller && <div className="muted">Vendedor: {w.seller}</div>}
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
          statusLoading={statusUpdatingId === selectedWantedCar.id}
          statusError={statusError}
          clientSavingId={clientSavingId}
          clientSaveError={clientSaveError}
          onSaveClient={(patch) => updateWantedDetails(selectedWantedCar.id, patch)}
          onClose={closeWantedDetails}
          onMarkBought={() => updateWantedStatus(selectedWantedCar.id, 'BOUGHT')}
          onArchive={() => updateWantedStatus(selectedWantedCar.id, 'ARCHIVED')}
          onPageChange={handleCarsPageChange}
        />
      )}
    </div>
  );
}
