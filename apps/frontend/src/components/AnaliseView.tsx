import type { Analise, CategoriaAlerta, Funilaria, ResultadoFunilaria, VerificacaoFunilaria } from '../services/dossie-types';
import { BotaoVisitar } from './VisitasDoCarro';
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

const VERIFICACAO_FUNILARIA: Record<VerificacaoFunilaria, { titulo: string; dica: string }> = {
  tom_e_brilho: { titulo: 'Tom e brilho entre peças', dica: 'Peças vizinhas sob a mesma luz devem ter a mesma cor e o mesmo reflexo.' },
  textura_casca_laranja: { titulo: 'Textura da pintura', dica: 'Reflexo ondulado ("casca de laranja"), escorrimento ou poeira presa indicam repintura.' },
  nevoa_em_borrachas_e_frisos: { titulo: 'Névoa em borrachas e frisos', dica: 'Pintura original nunca invade borrachas, frisos, plásticos e cantos.' },
  vaos_e_alinhamento: { titulo: 'Vãos e alinhamento', dica: 'Frestas de capô, portas e tampa iguais dos dois lados.' },
  farois_e_lanternas: { titulo: 'Faróis e lanternas', dica: 'Um farol novo e o outro amarelado sugere troca após batida daquele lado.' },
  parafusos_e_fixacoes: { titulo: 'Parafusos e fixações', dica: 'Tinta quebrada ou marca de chave em parafusos de para-lama, capô e portas.' },
  soleiras_e_parte_baixa: { titulo: 'Soleiras e parte baixa', dica: 'Amassados, raspões, ferrugem ou repintura na base das laterais.' },
  vidros_e_gravacoes: { titulo: 'Vidros e gravações', dica: 'Vidro sem a gravação da montadora, ou com data diferente, foi trocado.' },
  etiquetas_e_adesivos: { titulo: 'Etiquetas e adesivos', dica: 'Etiqueta de fábrica faltando em uma porta ou no capô.' },
  sinais_de_enchente: { titulo: 'Sinais de enchente', dica: 'Oxidação em parafusos internos, barro ou mancha no carpete, farol embaçado.' }
};

const RESULTADO_FUNILARIA: Record<ResultadoFunilaria, { label: string; tone: string; icone: string }> = {
  sem_sinais: { label: 'Sem sinais', tone: 'ok', icone: '✅' },
  suspeito: { label: 'Suspeito', tone: 'warn', icone: '⚠️' },
  evidente: { label: 'Evidente', tone: 'bad', icone: '⛔' },
  nao_avaliavel: { label: 'Sem foto da área', tone: '', icone: '👁️' }
};

const AVALIACAO_FUNILARIA = {
  sem_sinais: { label: 'Sem sinais de repintura ou batida nas fotos', tone: 'ok' },
  sinais_leves: { label: 'Sinais leves: confira pessoalmente', tone: 'warn' },
  sinais_fortes: { label: 'Sinais fortes de repintura ou batida', tone: 'bad' },
  sem_evidencia: { label: 'Fotos não permitem avaliar a funilaria', tone: '' }
} as const;

const ORDEM_RESULTADO: ResultadoFunilaria[] = ['evidente', 'suspeito', 'sem_sinais', 'nao_avaliavel'];

function FunilariaSection({ funilaria }: { funilaria: Funilaria }) {
  const avaliacao = AVALIACAO_FUNILARIA[funilaria.avaliacao];
  const verificacoes = [...funilaria.verificacoes].sort(
    (x, y) => ORDEM_RESULTADO.indexOf(x.resultado) - ORDEM_RESULTADO.indexOf(y.resultado)
  );
  return (
    <Section title="Funilaria e pintura">
      <div className="dx-chips" style={{ marginTop: 0, marginBottom: 8 }}>
        <span className={`dx-chip ${avaliacao.tone}`}>{avaliacao.label}</span>
      </div>
      <p className="dx-p" style={{ marginBottom: 10 }}>{funilaria.resumo}</p>
      <ul className="dx-list">
        {verificacoes.map((v) => {
          const meta = VERIFICACAO_FUNILARIA[v.item] ?? { titulo: v.item, dica: '' };
          const res = RESULTADO_FUNILARIA[v.resultado];
          return (
            <li key={v.item}>
              <div className="dx-row">
                <strong>{meta.titulo}</strong>
                <span className={`dx-chip ${res.tone}`}>{res.icone} {res.label}</span>
              </div>
              {v.pecas.length > 0 && <div className="dx-chips">{v.pecas.map((p) => <span key={p} className="dx-chip">{p}</span>)}</div>}
              <p className="dx-p">{v.resultado === 'nao_avaliavel' && !v.evidencia ? meta.dica : v.evidencia}</p>
              {v.resultado !== 'nao_avaliavel' && <p className="dx-p dx-muted" style={{ fontSize: 12 }}>{meta.dica}</p>}
            </li>
          );
        })}
      </ul>
      {funilaria.areas_sem_foto.length > 0 && (
        <div className="dx-callout" style={{ marginTop: 12 }}>
          <strong>Veja pessoalmente:</strong> o anúncio não mostra {funilaria.areas_sem_foto.join(', ')}.
        </div>
      )}
    </Section>
  );
}

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

      {a.funilaria && <FunilariaSection funilaria={a.funilaria} />}

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
          {id.marca && id.modelo && id.ano_modelo && (
            <div style={{ marginTop: 12 }}>
              <BotaoVisitar
                nova={{ marca: id.marca, modelo: id.modelo, ano: id.ano_modelo, versao: id.versao, analiseId: r.id, anuncioUrl: r.url }}
              />
              <div className="dx-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Abre um checklist para o celular com a base de vistoria, os pontos fracos deste modelo e as suspeitas levantadas acima.
              </div>
            </div>
          )}
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
