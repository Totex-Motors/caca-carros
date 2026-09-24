import type { Analise, CategoriaAlerta } from '../services/dossie-types';
import { DossieView, formatBRL, formatRange, GRAVIDADE, ORDEM_GRAVIDADE, ScoreRing, Section, Stat } from './DossieView';

const RECOMENDACAO = {
  seguir: { titulo: 'Sem sinais relevantes de risco', icone: '✅' },
  seguir_com_cautela: { titulo: 'Seguir com cautela: há pontos a esclarecer', icone: '⚠️' },
  evitar: { titulo: 'Evite este anúncio: sinais fortes de risco', icone: '⛔' }
} as const;

const CATEGORIA: Record<CategoriaAlerta, string> = {
  golpe: 'Possível golpe',
  km: 'Quilometragem',
  preco: 'Preço',
  divergencia: 'Divergência',
  estrutura: 'Estrutura / funilaria',
  mecanica: 'Mecânica',
  documentacao: 'Documentação',
  outro: 'Outro'
};

const KM = {
  compativel: { label: 'Compatível', tone: 'ok' },
  suspeito: { label: 'Suspeita', tone: 'warn' },
  incompativel: { label: 'Incompatível', tone: 'bad' },
  sem_evidencia: { label: 'Sem evidência nas fotos', tone: '' }
} as const;

const PRECO = {
  muito_abaixo: { label: 'Muito abaixo da FIPE', tone: 'bad' },
  abaixo: { label: 'Abaixo da FIPE', tone: 'warn' },
  dentro: { label: 'Dentro da faixa FIPE', tone: 'ok' },
  acima: { label: 'Acima da FIPE', tone: 'info' }
} as const;

export function AnaliseView(props: { analise: Analise; fotosEnviadas: string[] }) {
  const { analise: r } = props;
  const a = r.analise;
  const id = r.identificacao;
  const fotos = props.fotosEnviadas.length > 0 ? [...props.fotosEnviadas, ...r.fotos] : r.fotos;
  const alertas = [...a.alertas].sort(
    (x, y) => ORDEM_GRAVIDADE.indexOf(x.gravidade) - ORDEM_GRAVIDADE.indexOf(y.gravidade)
  );
  const rec = RECOMENDACAO[a.recomendacao];

  return (
    <div className="dx">
      <div className={`dx-verdict ${a.recomendacao}`}>
        {rec.icone} {rec.titulo}
        <small>{a.resumo}</small>
      </div>

      <div className="card">
        <div className="dx-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="dx-title">{r.titulo}</h2>
            <div className="dx-chips">
              {id.versao && <span className="dx-chip">{id.versao}</span>}
              {id.cidade && <span className="dx-chip">📍 {id.cidade}{id.uf ? `/${id.uf}` : ''}</span>}
              {id.tipo_vendedor !== 'desconhecido' && (
                <span className="dx-chip">{id.tipo_vendedor === 'loja' ? '🏪 Loja' : '👤 Particular'}</span>
              )}
              {r.url && (
                <a className="dx-chip info" href={r.url} target="_blank" rel="noreferrer">Abrir anúncio ↗</a>
              )}
            </div>
          </div>
          <ScoreRing value={a.score_confianca} max={100} label="Confiança no anúncio" />
        </div>
      </div>

      <div className="dx-stats">
        <Stat label="Preço anunciado" value={formatBRL(id.preco_anunciado)} hint={r.preco_vs_fipe ? PRECO[r.preco_vs_fipe.situacao].label : undefined} />
        <Stat
          label="FIPE do ano"
          value={r.fipe ? formatRange(r.fipe.faixa) : 'Não encontrada'}
          hint={r.preco_vs_fipe && r.preco_vs_fipe.diferenca_pct !== 0 ? `${r.preco_vs_fipe.diferenca_pct > 0 ? '+' : ''}${r.preco_vs_fipe.diferenca_pct}% da faixa` : r.fipe ? `Ref. ${r.fipe.referencia}` : undefined}
        />
        <Stat label="KM anunciada" value={id.km_anunciado ? `${id.km_anunciado.toLocaleString('pt-BR')} km` : '—'} hint={`Leitura: ${KM[a.km.compatibilidade].label}`} />
        <Stat label="Custo imediato" value={formatRange(a.custo_imediato_estimado_brl)} hint="Estimativa da IA" />
      </div>

      <Section title={`Alertas (${alertas.length})`}>
        {alertas.length === 0 && <p className="dx-p dx-muted">Nenhum alerta com evidência no anúncio.</p>}
        {alertas.map((al) => (
          <div key={al.titulo} className={`dx-alert ${al.gravidade}`}>
            <div className="dx-chips" style={{ marginTop: 0, marginBottom: 6 }}>
              <span className={`dx-chip ${GRAVIDADE[al.gravidade].tone}`}>{GRAVIDADE[al.gravidade].label}</span>
              <span className="dx-chip">{CATEGORIA[al.categoria]}</span>
            </div>
            <strong>{al.titulo}</strong>
            <p className="dx-p"><span className="dx-muted">Evidência:</span> {al.evidencia}</p>
            <p className="dx-p"><span className="dx-muted">Como verificar:</span> {al.como_verificar}</p>
          </div>
        ))}
      </Section>

      <div className="dx-grid-2">
        <Section title="Quilometragem">
          <span className={`dx-chip ${KM[a.km.compatibilidade].tone}`}>{KM[a.km.compatibilidade].label}</span>
          {a.km.leitura_odometro && <p className="dx-p"><span className="dx-muted">Odômetro nas fotos:</span> {a.km.leitura_odometro}</p>}
          <p className="dx-p"><span className="dx-muted">Desgaste:</span> {a.km.indicios_desgaste}</p>
          <p className="dx-p">{a.km.justificativa}</p>
        </Section>

        <Section title="Pontos positivos">
          {a.pontos_positivos.length === 0 ? (
            <p className="dx-p dx-muted">Nenhum ponto positivo com evidência clara.</p>
          ) : (
            <ul className="dx-bullets">{a.pontos_positivos.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
        </Section>
      </div>

      {fotos.length > 0 && (
        <Section title="Fotos analisadas">
          <div className="dx-photos">
            {fotos.map((src, i) => {
              const obs = a.fotos.filter((f) => f.foto === i + 1).map((f) => f.observacao).join(' ');
              return (
                <div key={src.slice(0, 80) + i} className="dx-photo">
                  <img src={src} alt={`Foto ${i + 1}`} referrerPolicy="no-referrer" loading="lazy" />
                  <p><strong>Foto {i + 1}.</strong> {obs || <span className="dx-muted">Sem observações.</span>}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="dx-grid-2">
        <Section title="Perguntas ao vendedor">
          <ol className="dx-bullets">{a.perguntas_ao_vendedor.map((p) => <li key={p}>{p}</li>)}</ol>
        </Section>
        <Section title="Checklist da vistoria">
          <ul className="dx-bullets">{a.checklist_vistoria.map((p) => <li key={p}>☐ {p}</li>)}</ul>
        </Section>
      </div>

      {r.dossie ? (
        <>
          <h2 className="section-title" style={{ marginTop: 8 }}>Dossiê do modelo</h2>
          <DossieView dossie={r.dossie} />
        </>
      ) : (
        r.dossie_erro && <div className="dx-note">ℹ️ Dossiê do modelo indisponível: {r.dossie_erro}</div>
      )}

      <div className="dx-note">
        <span>ℹ️</span>
        <span>
          Vistoria remota feita por IA a partir do texto e das fotos do anúncio. Ela aponta riscos e o que conferir, mas não
          substitui a vistoria presencial, a consulta do chassi/placa e a checagem de débitos e documentação.
        </span>
      </div>
    </div>
  );
}
