import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CarDTO, WantedCarDTO } from '@caca/shared/types/car';
import { api } from '../services/api';
import { apiErrorMessage, UFS } from '../services/dossie';
import type { Faixa } from '../services/dossie-types';
import { LastSearchChips } from './LastSearchChips';

// Jornada de comparativo: a partir do carro consultado (dossie ou analise), busca as ofertas do mesmo
// modelo/ano nos portais com os filtros escolhidos e compara cada preco com a FIPE.

type Props = {
  marca: string;
  modelo: string;
  ano: number;
  fipe: Faixa | null;
  uf: string;
};

type Filtros = {
  anoDe: string;
  anoAte: string;
  uf: string;
  cidade: string;
  anunciante: '' | 'PRIVATE' | 'PROFESSIONAL';
  kmMax: string;
  precoMax: string;
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function numero(valor: string): number | null {
  const n = Number(valor.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function comparaFipe(preco: number, fipe: Faixa | null): { texto: string; tom: string } | null {
  if (!fipe || preco <= 0) return null;
  if (preco < fipe.min) {
    const pct = Math.round(((fipe.min - preco) / fipe.min) * 100);
    return { texto: `${pct}% abaixo da FIPE`, tom: pct >= 20 ? 'bad' : 'ok' };
  }
  if (preco > fipe.max) {
    const pct = Math.round(((preco - fipe.max) / fipe.max) * 100);
    return { texto: `${pct}% acima da FIPE`, tom: 'warn' };
  }
  return { texto: 'Dentro da FIPE', tom: 'ok' };
}

export function BuscarOfertas({ marca, modelo, ano, fipe, uf }: Props) {
  const [aberto, setAberto] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({
    anoDe: String(ano),
    anoAte: String(ano),
    uf,
    cidade: '',
    anunciante: '',
    kmMax: '',
    precoMax: ''
  });
  const [wanted, setWanted] = useState<WantedCarDTO | null>(null);
  const [ofertas, setOfertas] = useState<CarDTO[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Enquanto a busca roda, atualiza o status e as ofertas a cada 10 s.
  useEffect(() => {
    if (!wanted) return;
    let ativo = true;
    async function atualizar() {
      if (!wanted) return;
      try {
        const [lista, carros] = await Promise.all([
          api.get<WantedCarDTO[]>('/cars/wanted'),
          api.get<{ data: CarDTO[] }>(`/cars/wanted/${wanted.id}/cars`, { params: { limit: 50 } })
        ]);
        if (!ativo) return;
        const atual = lista.data.find((w) => w.id === wanted.id);
        if (atual && (atual.searching !== wanted.searching || atual.lastSearch?.finishedAt !== wanted.lastSearch?.finishedAt)) {
          setWanted(atual);
        }
        setOfertas(carros.data.data);
      } catch {
        // tenta de novo no proximo ciclo
      }
    }
    atualizar();
    const id = wanted.searching ? window.setInterval(atualizar, 10_000) : undefined;
    return () => {
      ativo = false;
      if (id !== undefined) window.clearInterval(id);
    };
  }, [wanted]);

  const ordenadas = useMemo(
    () => [...ofertas].sort((a, b) => (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER)),
    [ofertas]
  );

  async function buscar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const anoDe = numero(filtros.anoDe);
    const anoAte = numero(filtros.anoAte);
    if (!anoDe || !anoAte || anoDe > anoAte) {
      setErro('Confira os anos: o ano inicial não pode ser maior que o final.');
      return;
    }
    setEnviando(true);
    try {
      const { data } = await api.post<WantedCarDTO>('/cars/wanted', {
        brand: marca,
        model: modelo,
        yearFrom: anoDe,
        yearTo: anoAte,
        condition: 'USED',
        state: filtros.uf || null,
        city: filtros.cidade.trim() || null,
        sellerType: filtros.anunciante || null,
        mileageTo: numero(filtros.kmMax),
        maxPrice: numero(filtros.precoMax)
      });
      setOfertas([]);
      setWanted(data);
    } catch (error) {
      setErro(apiErrorMessage(error, 'Não foi possível iniciar a busca.'));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="card compare-cta">
        <div>
          <strong>Quer ver as ofertas deste carro?</strong>
          <div className="dx-muted" style={{ fontSize: 13 }}>
            Buscamos {marca} {modelo} na Webmotors, OLX e Mercado Livre com os seus filtros e comparamos cada preço com a FIPE.
          </div>
        </div>
        <button type="button" onClick={() => setAberto(true)}>🔎 Buscar ofertas deste carro</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="dx-section-title">Comparar ofertas · {marca} {modelo}</h3>
      <form onSubmit={buscar}>
        <div className="row">
          <div className="field">
            <label>Ano de</label>
            <input inputMode="numeric" value={filtros.anoDe} onChange={(e) => setFiltros((f) => ({ ...f, anoDe: e.target.value }))} maxLength={4} />
          </div>
          <div className="field">
            <label>Ano até</label>
            <input inputMode="numeric" value={filtros.anoAte} onChange={(e) => setFiltros((f) => ({ ...f, anoAte: e.target.value }))} maxLength={4} />
          </div>
          <div className="field">
            <label>Estado</label>
            <select value={filtros.uf} onChange={(e) => setFiltros((f) => ({ ...f, uf: e.target.value }))}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Cidade (opcional)</label>
            <input value={filtros.cidade} onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))} placeholder="Estado inteiro" maxLength={80} />
          </div>
          <div className="field">
            <label>Anunciante</label>
            <select value={filtros.anunciante} onChange={(e) => setFiltros((f) => ({ ...f, anunciante: e.target.value as Filtros['anunciante'] }))}>
              <option value="">Qualquer</option>
              <option value="PRIVATE">Particular</option>
              <option value="PROFESSIONAL">Loja / Concessionária</option>
            </select>
          </div>
          <div className="field">
            <label>KM máximo</label>
            <input inputMode="numeric" value={filtros.kmMax} onChange={(e) => setFiltros((f) => ({ ...f, kmMax: e.target.value }))} placeholder="Sem limite" />
          </div>
          <div className="field">
            <label>Preço máximo</label>
            <input
              inputMode="numeric"
              value={filtros.precoMax}
              onChange={(e) => setFiltros((f) => ({ ...f, precoMax: e.target.value }))}
              placeholder={fipe ? `FIPE até ${brl.format(fipe.max)}` : 'Sem limite'}
            />
          </div>
        </div>
        <div className="consulta-actions">
          <button type="submit" disabled={enviando || Boolean(wanted?.searching)}>
            {wanted ? '↻ Buscar de novo com estes filtros' : '🔎 Buscar ofertas'}
          </button>
          <span className="dx-muted" style={{ fontSize: 12 }}>O carro também entra em "Completo" e continua sendo buscado automaticamente.</span>
        </div>
        {erro && <div className="error" style={{ marginTop: 12 }}>{erro}</div>}
      </form>

      {wanted && (
        <div style={{ marginTop: 16 }}>
          {wanted.searching ? (
            <div className="loading-steps">
              <div className="spinner" />
              <div>
                <strong>Buscando nos portais…</strong>
                <div className="dx-muted" style={{ fontSize: 13 }}>Pode levar alguns minutos. As ofertas aparecem aqui assim que chegarem.</div>
              </div>
            </div>
          ) : (
            <LastSearchChips lastSearch={wanted.lastSearch} />
          )}

          {ordenadas.length > 0 && (
            <table className="dx-table" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>Oferta</th><th>Ano · KM</th><th>Local</th><th style={{ textAlign: 'right' }}>Preço</th><th /></tr>
              </thead>
              <tbody>
                {ordenadas.map((car) => {
                  const cmp = comparaFipe(car.price, fipe);
                  return (
                    <tr key={car.url}>
                      <td>
                        <a href={car.url} target="_blank" rel="noreferrer">{car.title}</a>
                        {car.portal && <span className="dx-chip" style={{ marginLeft: 6 }}>{car.portal}</span>}
                      </td>
                      <td className="dx-muted">{car.year} · {car.km !== null ? `${car.km.toLocaleString('pt-BR')} km` : '—'}</td>
                      <td className="dx-muted">{[car.city, car.state].filter(Boolean).join('/') || '—'}</td>
                      <td className="num">
                        {car.price > 0 ? brl.format(car.price) : 'Sob consulta'}
                        {cmp && <div><span className={`dx-chip ${cmp.tom}`}>{cmp.texto}</span></div>}
                      </td>
                      <td>
                        <Link to={`/consulta?url=${encodeURIComponent(car.url)}`} className="dx-chip info">🔍 Analisar</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
