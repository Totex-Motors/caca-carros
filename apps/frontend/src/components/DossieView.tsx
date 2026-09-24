import type { ReactNode } from 'react';
import type { Dossie, Faixa, Gravidade, Motorizacao } from '../services/dossie-types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR');

export function formatBRL(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : brl.format(value);
}

export function formatRange(range: Faixa | null | undefined): string {
  if (!range) return '—';
  return range.min === range.max ? formatBRL(range.min) : `${formatBRL(range.min)} – ${formatBRL(range.max)}`;
}

function formatKm(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${num.format(value)} km`;
}

function kml(range: Faixa | null): string {
  if (!range) return '—';
  return range.min === range.max ? `${num.format(range.min)} km/l` : `${num.format(range.min)}–${num.format(range.max)} km/l`;
}

export const GRAVIDADE: Record<Gravidade, { label: string; tone: string }> = {
  critica: { label: 'Crítica', tone: 'bad' },
  alta: { label: 'Alta', tone: 'bad' },
  media: { label: 'Média', tone: 'warn' },
  baixa: { label: 'Baixa', tone: '' }
};
export const ORDEM_GRAVIDADE: Gravidade[] = ['critica', 'alta', 'media', 'baixa'];

const COMANDO: Record<Motorizacao['comando_valvulas'], { label: string; tone: string }> = {
  corrente: { label: 'Corrente de comando', tone: 'ok' },
  correia: { label: 'Correia dentada', tone: 'warn' },
  correia_banhada_oleo: { label: 'Correia banhada a óleo', tone: 'bad' },
  desconhecido: { label: 'Comando não confirmado', tone: '' }
};

const CONFIANCA = { alta: 'alta', media: 'média', baixa: 'baixa' } as const;

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <h3 className="dx-section-title">{props.title}</h3>
      {props.children}
    </div>
  );
}

export function Stat(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="dx-stat">
      <div className="dx-stat-label">{props.label}</div>
      <div className="dx-stat-value">{props.value}</div>
      {props.hint && <div className="dx-stat-hint">{props.hint}</div>}
    </div>
  );
}

export function ScoreRing(props: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(1, props.value / props.max));
  const color = pct >= 0.75 ? 'var(--success)' : pct >= 0.5 ? '#d97706' : 'var(--danger)';
  return (
    <div className="dx-score">
      <div className="dx-ring" style={{ background: `conic-gradient(${color} ${pct * 360}deg, var(--primary-light) 0deg)` }}>
        <div>{num.format(props.value)}</div>
      </div>
      <span className="dx-muted" style={{ fontSize: 12, maxWidth: 70 }}>{props.label}</span>
    </div>
  );
}

export function DossieView({ dossie }: { dossie: Dossie }) {
  const d = dossie.dados;
  const defeitos = [...d.defeitos_cronicos].sort(
    (a, b) => ORDEM_GRAVIDADE.indexOf(a.gravidade) - ORDEM_GRAVIDADE.indexOf(b.gravidade)
  );

  return (
    <div className="dx">
      <div className="card">
        <div className="dx-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="dx-title">
              {d.veiculo.marca} {d.veiculo.modelo} <span className="year">{d.veiculo.ano}</span>
            </h2>
            <div className="dx-sub">{d.veiculo.geracao}</div>
            <div className="dx-chips">
              {dossie.cache && <span className="dx-chip info">Do acervo</span>}
              {d.veiculo.versoes_comuns.map((v) => <span key={v} className="dx-chip">{v}</span>)}
            </div>
          </div>
          <ScoreRing value={d.veredito.nota} max={10} label="Nota de compra" />
        </div>
        <p className="dx-p" style={{ marginTop: 12 }}>{d.resumo}</p>
      </div>

      <div className="dx-stats">
        <Stat
          label="FIPE"
          value={dossie.fipe ? formatRange(dossie.fipe.faixa) : 'Indisponível'}
          hint={dossie.fipe ? `Ref. ${dossie.fipe.referencia}` : 'Tabela FIPE fora do ar'}
        />
        <Stat
          label={`IPVA ${dossie.ipva?.uf ?? ''}`}
          value={dossie.ipva ? formatRange(dossie.ipva.faixa) : '—'}
          hint={dossie.ipva ? `Alíquota ${num.format(dossie.ipva.aliquota * 100)}%` : 'Depende do valor FIPE'}
        />
        <Stat label="Seguro/ano" value={formatRange(d.seguro_anual_estimado_brl)} hint="Estimativa da IA" />
        <Stat label="Consumo real" value={kml(d.consumo.real_cidade_kml)} hint={`Cidade · ${d.consumo.combustivel_referencia}`} />
      </div>

      <Section title="Mecânica">
        {d.motorizacoes.map((m) => (
          <div key={m.nome} className="dx-box">
            <div className="dx-row" style={{ alignItems: 'center' }}>
              <h4>{m.nome}</h4>
              <div className="dx-chips" style={{ marginTop: 0 }}>
                {m.codigo_motor && <span className="dx-chip mono">{m.codigo_motor}</span>}
                <span className={`dx-chip ${COMANDO[m.comando_valvulas].tone}`}>{COMANDO[m.comando_valvulas].label}</span>
              </div>
            </div>
            <dl className="dx-specs">
              <div><dt>Potência</dt><dd>{m.potencia_cv ?? '—'}</dd></div>
              <div><dt>Torque</dt><dd>{m.torque_kgfm ?? '—'}</dd></div>
              <div><dt>Cilindrada</dt><dd>{m.cilindrada_cc ? `${num.format(m.cilindrada_cc)} cm³` : '—'}</dd></div>
              <div><dt>Combustível</dt><dd>{m.combustivel}</dd></div>
            </dl>
            <div className="dx-callout">
              <div className="dx-muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Troca do comando: {m.intervalo_troca_comando_km ? formatKm(m.intervalo_troca_comando_km) : 'sem troca programada'}
                {m.custo_troca_comando_brl && ` · ${formatRange(m.custo_troca_comando_brl)}`}
              </div>
              {m.impacto_financeiro_comando}
            </div>
            {m.observacoes && <p className="dx-p dx-muted">{m.observacoes}</p>}
          </div>
        ))}

        {d.cambios.map((c) => (
          <div key={c.fabricante_modelo + c.tipo} className="dx-box">
            <div className="dx-muted" style={{ fontSize: 12 }}>{c.tipo}</div>
            <h4>{c.fabricante_modelo}</h4>
            <dl className="dx-specs">
              <div><dt>Marchas</dt><dd>{c.marchas ?? 'CVT / não se aplica'}</dd></div>
              <div><dt>Troca de fluido</dt><dd>{c.troca_fluido_km ? `a cada ${formatKm(c.troca_fluido_km)}` : '—'}</dd></div>
            </dl>
            <p className="dx-p dx-muted">{c.pontos_atencao}</p>
          </div>
        ))}

        <div className="dx-box">
          <h4>Suspensão</h4>
          <dl className="dx-specs">
            <div><dt>Dianteira</dt><dd>{d.suspensao.dianteira}</dd></div>
            <div><dt>Traseira</dt><dd>{d.suspensao.traseira}</dd></div>
          </dl>
          <p className="dx-p dx-muted">{d.suspensao.pontos_atencao}</p>
        </div>
      </Section>

      <Section title="Cronologia de defeitos">
        {defeitos.length === 0 ? (
          <p className="dx-p dx-muted">Nenhum defeito crônico relevante registrado.</p>
        ) : (
          <ul className="dx-list">
            {defeitos.map((def) => (
              <li key={def.titulo}>
                <div className="dx-row">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <span className={`dx-chip ${GRAVIDADE[def.gravidade].tone}`}>{GRAVIDADE[def.gravidade].label}</span>{' '}
                    <strong>{def.titulo}</strong> <span className="dx-muted" style={{ fontSize: 12 }}>· {def.km_tipico}</span>
                    <p className="dx-p"><span className="dx-muted">Sintoma:</span> {def.sintoma}</p>
                    <p className="dx-p"><span className="dx-muted">Causa:</span> {def.causa}</p>
                  </div>
                  <span className="dx-money">{formatRange(def.custo_reparo_brl)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="dx-grid-2">
        <Section title="Próximos 20.000 km">
          <ol className="dx-timeline">
            {d.plano_manutencao_20k.map((rev) => (
              <li key={rev.km}>
                <div className="dx-row">
                  <strong>{rev.km === 0 ? 'Na compra' : `+${formatKm(rev.km)}`}</strong>
                  <span className="dx-money">{formatRange(rev.custo_estimado_brl)}</span>
                </div>
                <ul className="dx-bullets dx-muted">
                  {rev.itens.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Peças de desgaste">
          <table className="dx-table">
            <thead>
              <tr><th>Peça</th><th>Dura</th><th style={{ textAlign: 'right' }}>Custo</th></tr>
            </thead>
            <tbody>
              {d.pecas_desgaste.map((p) => (
                <tr key={p.peca}>
                  <td>{p.peca}</td>
                  <td className="dx-muted">{p.durabilidade_km}</td>
                  <td className="num">{formatRange(p.custo_brl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="dx-specs dx-box" style={{ marginTop: 12 }}>
            <div><dt>Inmetro cidade ({d.consumo.combustivel_referencia})</dt><dd>{d.consumo.inmetro_cidade_kml ? `${num.format(d.consumo.inmetro_cidade_kml)} km/l` : '—'}</dd></div>
            <div><dt>Inmetro estrada</dt><dd>{d.consumo.inmetro_estrada_kml ? `${num.format(d.consumo.inmetro_estrada_kml)} km/l` : '—'}</dd></div>
            <div><dt>Real cidade</dt><dd>{kml(d.consumo.real_cidade_kml)}</dd></div>
            <div><dt>Real estrada</dt><dd>{kml(d.consumo.real_estrada_kml)}</dd></div>
          </dl>
        </Section>
      </div>

      {dossie.fipe && (
        <Section title={`Tabela FIPE · ${dossie.fipe.referencia}`}>
          <table className="dx-table">
            <tbody>
              {dossie.fipe.versoes.map((v) => (
                <tr key={v.codigo_fipe + v.nome}>
                  <td>{v.nome}</td>
                  <td className="dx-muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{v.codigo_fipe}</td>
                  <td className="num">{formatBRL(v.preco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dossie.ipva && <p className="dx-p dx-muted" style={{ fontSize: 12 }}>{dossie.ipva.observacao}</p>}
        </Section>
      )}

      <Section title="Veredito">
        <p className="dx-p">{d.veredito.resumo}</p>
        <div className="dx-grid-2" style={{ marginTop: 12 }}>
          <div>
            <strong style={{ color: 'var(--success)' }}>Indicado para</strong>
            <ul className="dx-bullets">{d.veredito.indicado_para.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
          <div>
            <strong style={{ color: 'var(--danger)' }}>Não indicado para</strong>
            <ul className="dx-bullets">{d.veredito.nao_indicado_para.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        </div>
      </Section>

      <div className="dx-note">
        <span>ℹ️</span>
        <span>
          <strong>Confiança {CONFIANCA[d.confianca.nivel]}.</strong> {d.confianca.observacao} FIPE e IPVA são calculados a partir
          da tabela FIPE; custos, seguro e consumo real são estimativas da IA ({dossie.modelo_ia}) e devem ser confirmados com
          um mecânico antes da compra.
        </span>
      </div>
    </div>
  );
}
