import type { ReactNode } from 'react';
import type { Analise, Faixa, Gravidade } from '../shared/types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : brl.format(v));
const faixa = (f: Faixa | null | undefined) => (!f ? '—' : f.min === f.max ? fmt(f.min) : `${fmt(f.min)} – ${fmt(f.max)}`);

const ORDEM: Gravidade[] = ['critica', 'alta', 'media', 'baixa'];
const COR_GRAVIDADE: Record<Gravidade, string> = {
  critica: 'bg-red-100 text-red-800 border-red-300',
  alta: 'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-800 border-amber-200',
  baixa: 'bg-slate-50 text-slate-600 border-slate-200'
};
const ROTULO_GRAVIDADE: Record<Gravidade, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const VEREDITO = {
  seguir: { cor: 'from-green-600 to-green-700', texto: '✅ Sem sinais relevantes de risco' },
  seguir_com_cautela: { cor: 'from-amber-500 to-amber-700', texto: '⚠️ Cautela: pontos a esclarecer' },
  evitar: { cor: 'from-red-600 to-red-800', texto: '⛔ Evite: sinais fortes de risco' }
} as const;

const PRECO = {
  muito_abaixo: 'Muito abaixo da FIPE',
  abaixo: 'Abaixo da FIPE',
  dentro: 'Dentro da FIPE',
  acima: 'Acima da FIPE'
} as const;

const KM = {
  compativel: 'Compatível',
  suspeito: 'Suspeita',
  incompativel: 'Incompatível',
  sem_evidencia: 'Sem evidência nas fotos'
} as const;

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">{titulo}</h3>
      {children}
    </section>
  );
}

function Stat({ rotulo, valor, dica }: { rotulo: string; valor: string; dica?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{rotulo}</div>
      <div className="mt-0.5 text-sm font-extrabold text-brand-dark">{valor}</div>
      {dica && <div className="text-[11px] text-slate-500">{dica}</div>}
    </div>
  );
}

export type Estado =
  | { fase: 'pronto' }
  | { fase: 'analisando'; etapa: string }
  | { fase: 'erro'; mensagem: string; precisaLogin?: boolean }
  | { fase: 'resultado'; analise: Analise; fotosEnviadas: string[] };

type Props = {
  portal: string;
  estado: Estado;
  apiBase: string;
  onAnalisar: () => void;
  onFechar: () => void;
};

export function Drawer({ portal, estado, apiBase, onAnalisar, onFechar }: Props) {
  return (
    <div className="fixed inset-y-0 right-0 z-[2147483647] flex w-[420px] max-w-[100vw] flex-col bg-slate-50 font-sans text-slate-900 shadow-2xl">
      <header className="flex items-center justify-between bg-gradient-to-r from-brand to-brand-dark px-4 py-3 text-white">
        <div>
          <div className="text-sm font-extrabold">AutoExpert AI</div>
          <div className="text-[11px] opacity-90">Vistoria do anúncio · {portal}</div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-lg bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25"
          aria-label="Fechar"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-[13px] leading-relaxed">
        {estado.fase === 'pronto' && (
          <div className="space-y-3">
            <p>
              A IA vai ler este anúncio e as fotos para conferir <strong>preço x FIPE</strong>, <strong>km pelas fotos</strong>,
              divergências, sinais de funilaria e de <strong>golpe</strong>, e juntar o dossiê técnico do modelo.
            </p>
            <button
              type="button"
              onClick={onAnalisar}
              className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-extrabold text-white shadow-lg hover:opacity-95"
            >
              🔍 Analisar este anúncio
            </button>
            <p className="text-[11px] text-slate-500">
              O texto e as fotos são enviados ao seu servidor do caça-carros, que usa a IA. Leva de 1 a 3 minutos.
            </p>
          </div>
        )}

        {estado.fase === 'analisando' && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-brand-light border-t-brand" />
            <div>
              <div className="font-bold">{estado.etapa}</div>
              <div className="text-[11px] text-slate-500">Pode continuar navegando nesta aba.</div>
            </div>
          </div>
        )}

        {estado.fase === 'erro' && (
          <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p>{estado.mensagem}</p>
            {!estado.precisaLogin && (
              <button type="button" onClick={onAnalisar} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white">
                Tentar de novo
              </button>
            )}
          </div>
        )}

        {estado.fase === 'resultado' && <Resultado analise={estado.analise} fotosEnviadas={estado.fotosEnviadas} apiBase={apiBase} />}
      </div>
    </div>
  );
}

function Resultado({ analise: r, fotosEnviadas, apiBase }: { analise: Analise; fotosEnviadas: string[]; apiBase: string }) {
  const a = r.analise;
  const id = r.identificacao;
  const alertas = [...a.alertas].sort((x, y) => ORDEM.indexOf(x.gravidade) - ORDEM.indexOf(y.gravidade));
  const d = r.dossie?.dados;
  const consulta = [id.marca, id.modelo, id.ano_modelo].filter(Boolean).join(' ');

  return (
    <>
      <div className={`rounded-2xl bg-gradient-to-r ${VEREDITO[a.recomendacao].cor} p-4 text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="font-extrabold">{VEREDITO[a.recomendacao].texto}</div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-base font-black text-slate-900">
            {a.score_confianca}
          </div>
        </div>
        <p className="mt-2 text-[12px] opacity-95">{a.resumo}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat rotulo="Preço" valor={fmt(id.preco_anunciado)} dica={r.preco_vs_fipe ? PRECO[r.preco_vs_fipe.situacao] : undefined} />
        <Stat
          rotulo="FIPE"
          valor={r.fipe ? faixa(r.fipe.faixa) : '—'}
          dica={r.preco_vs_fipe && r.preco_vs_fipe.diferenca_pct !== 0 ? `${r.preco_vs_fipe.diferenca_pct > 0 ? '+' : ''}${r.preco_vs_fipe.diferenca_pct}% da faixa` : r.fipe?.referencia}
        />
        <Stat rotulo="KM" valor={id.km_anunciado ? `${id.km_anunciado.toLocaleString('pt-BR')} km` : '—'} dica={KM[a.km.compatibilidade]} />
        <Stat rotulo={`IPVA ${r.dossie?.ipva?.uf ?? ''}`} valor={faixa(r.dossie?.ipva?.faixa)} dica="Sobre a faixa FIPE" />
      </div>

      <Bloco titulo={`Alertas (${alertas.length})`}>
        {alertas.length === 0 && <p className="text-slate-500">Nenhum alerta com evidência.</p>}
        <div className="space-y-2">
          {alertas.map((al) => (
            <div key={al.titulo} className={`rounded-xl border p-3 ${COR_GRAVIDADE[al.gravidade]}`}>
              <div className="text-[10px] font-extrabold uppercase">{ROTULO_GRAVIDADE[al.gravidade]}</div>
              <div className="font-bold text-slate-900">{al.titulo}</div>
              <p className="text-slate-700"><span className="text-slate-500">Evidência:</span> {al.evidencia}</p>
              <p className="text-slate-700"><span className="text-slate-500">Verificar:</span> {al.como_verificar}</p>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Quilometragem">
        {a.km.leitura_odometro && <p><span className="text-slate-500">Odômetro:</span> {a.km.leitura_odometro}</p>}
        <p><span className="text-slate-500">Desgaste:</span> {a.km.indicios_desgaste}</p>
        <p>{a.km.justificativa}</p>
      </Bloco>

      {fotosEnviadas.length > 0 && (
        <Bloco titulo="Fotos analisadas">
          <div className="grid grid-cols-3 gap-1.5">
            {fotosEnviadas.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt={`Foto ${i + 1}`} className="h-16 w-full rounded-lg object-cover" />
                <span className="absolute left-1 top-1 rounded bg-slate-900/70 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
            ))}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {a.fotos.map((f) => <li key={f.foto + f.observacao}><strong>Foto {f.foto}:</strong> {f.observacao}</li>)}
          </ul>
        </Bloco>
      )}

      <Bloco titulo="Perguntas ao vendedor">
        <ol className="list-decimal space-y-1 pl-4">{a.perguntas_ao_vendedor.map((p) => <li key={p}>{p}</li>)}</ol>
      </Bloco>

      <Bloco titulo="Checklist da vistoria">
        <ul className="space-y-1">{a.checklist_vistoria.map((p) => <li key={p}>☐ {p}</li>)}</ul>
      </Bloco>

      {d && (
        <Bloco titulo={`Dossiê ${d.veiculo.marca} ${d.veiculo.modelo} ${d.veiculo.ano} · nota ${d.veredito.nota}`}>
          <ul className="space-y-1">
            {d.motorizacoes.map((m) => (
              <li key={m.nome}>
                <strong>{m.nome}</strong>: {m.comando_valvulas === 'corrente' ? 'corrente de comando' : m.comando_valvulas === 'desconhecido' ? 'comando não confirmado' : 'correia'}
                {m.intervalo_troca_comando_km ? ` (troca a cada ${m.intervalo_troca_comando_km.toLocaleString('pt-BR')} km)` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-2 font-bold">Defeitos crônicos</div>
          <ul className="list-disc space-y-1 pl-4">
            {[...d.defeitos_cronicos]
              .sort((x, y) => ORDEM.indexOf(x.gravidade) - ORDEM.indexOf(y.gravidade))
              .slice(0, 4)
              .map((def) => <li key={def.titulo}>{def.titulo} · {faixa(def.custo_reparo_brl)}</li>)}
          </ul>
        </Bloco>
      )}

      {consulta && (
        <a
          href={`${apiBase.replace(/\/+$/, '')}/consulta?q=${encodeURIComponent(consulta)}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-brand bg-white py-2.5 text-center text-sm font-bold text-brand-dark hover:bg-brand-light"
        >
          Ver dossiê completo no caça-carros ↗
        </a>
      )}

      <p className="text-[11px] text-slate-500">
        Vistoria remota por IA. Não substitui a vistoria presencial, a consulta de chassi/placa e a checagem de débitos.
      </p>
    </>
  );
}
