import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnaliseView } from '../components/AnaliseView';
import { BuscarOfertas } from '../components/BuscarOfertas';
import { DossieView } from '../components/DossieView';
import { TopNav } from '../components/TopNav';
import type { Analise, Dossie } from '../services/dossie-types';
import {
  apiErrorMessage,
  fetchAnalise,
  fetchDossie,
  isBlockedError,
  readUf,
  resizePhoto,
  saveUf,
  UFS
} from '../services/dossie';
import { capturarComExtensao, detectarExtensao } from '../services/extensao';

const MAX_FOTOS = 8;

const ETAPAS_DOSSIE = [
  'Consultando o acervo…',
  'Identificando geração e versões…',
  'Levantando motor, câmbio e comando…',
  'Cruzando defeitos crônicos e custos…',
  'Buscando preços na tabela FIPE…',
  'Montando o plano de manutenção…'
];

const ETAPAS_ANALISE = [
  'Lendo o anúncio…',
  'Identificando o carro e comparando com a FIPE…',
  'Analisando as fotos: painel, volante, bancos e pedais…',
  'Procurando divergências e sinais de golpe…',
  'Conferindo funilaria e estrutura…',
  'Juntando o dossiê do modelo…'
];

type Resultado =
  | { tipo: 'dossie'; dossie: Dossie }
  | { tipo: 'analise'; analise: Analise; fotosEnviadas: string[] };

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function Loading({ etapas }: { etapas: string[] }) {
  const [etapa, setEtapa] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setEtapa((e) => Math.min(e + 1, etapas.length - 1)), 14000);
    return () => window.clearInterval(id);
  }, [etapas]);
  return (
    <div className="card loading-steps">
      <div className="spinner" />
      <div>
        <strong>{etapas[Math.min(etapa, etapas.length - 1)]}</strong>
        <div className="dx-muted" style={{ fontSize: 13 }}>
          Uma análise nova leva de 1 a 3 minutos. Dossiês que já estão no acervo abrem na hora.
        </div>
      </div>
    </div>
  );
}

export function Consulta() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [entrada, setEntrada] = useState('');
  const [texto, setTexto] = useState('');
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [uf, setUf] = useState(readUf);
  const [loading, setLoading] = useState<null | 'dossie' | 'analise'>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [extensao, setExtensao] = useState<string | null>(null);
  const [etapaExtensao, setEtapaExtensao] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ultimoAuto = useRef<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  useEffect(() => {
    detectarExtensao().then(setExtensao);
  }, []);

  async function executar(valor: string, opts: { texto: string; fotos: string[] }) {
    const alvo = valor.trim();
    const analisar = isUrl(alvo) || opts.texto.trim().length > 0 || opts.fotos.length > 0;
    if (!analisar && !alvo) return;

    setErro(null);
    setResultado(null);
    setLoading(analisar ? 'analise' : 'dossie');
    try {
      if (analisar) {
        let texto = opts.texto.trim() || (!isUrl(alvo) ? alvo : '');
        let fotosEnvio = opts.fotos;
        // Com a extensao, o anuncio e lido no navegador do usuario (com o login dele no portal, sem bloqueio).
        const versaoExtensao = extensao ?? (isUrl(alvo) ? await detectarExtensao() : null);
        if (isUrl(alvo) && !texto && versaoExtensao) {
          setEtapaExtensao('Abrindo o anúncio no seu navegador (aba em segundo plano)…');
          const captura = await capturarComExtensao(alvo);
          texto = `${captura.titulo}\n${captura.texto}`.trim();
          fotosEnvio = [...opts.fotos, ...captura.fotos].slice(0, MAX_FOTOS);
          setEtapaExtensao(null);
        }
        const analise = await fetchAnalise({
          url: isUrl(alvo) ? alvo : undefined,
          texto: texto || undefined,
          fotos: fotosEnvio,
          uf
        });
        setResultado({ tipo: 'analise', analise, fotosEnviadas: fotosEnvio });
      } else {
        setResultado({ tipo: 'dossie', dossie: await fetchDossie(alvo, uf) });
      }
    } catch (error) {
      if (isBlockedError(error)) {
        setMostrarTexto(true);
        setErro(
          'O portal bloqueou a leitura pelo servidor. Instale a extensão AutoExpert AI para ler pelo seu navegador, ' +
            'ou cole o texto do anúncio e envie as fotos.'
        );
      } else if (error instanceof Error && !('isAxiosError' in error)) {
        setMostrarTexto(true);
        setErro(error.message);
      } else {
        setErro(apiErrorMessage(error, 'Não foi possível concluir agora. Tente novamente em instantes.'));
      }
    } finally {
      setLoading(null);
      setEtapaExtensao(null);
    }
  }

  // Vindo de outro lugar (?url=<anuncio> ou ?q=<modelo ano>): dispara a consulta. Reage tambem a navegacao dentro
  // desta pagina (ex.: botao "Analisar" do comparativo).
  useEffect(() => {
    const valor = params.get('url') ?? params.get('q');
    if (!valor || ultimoAuto.current === valor) return;
    ultimoAuto.current = valor;
    setEntrada(valor);
    setTexto('');
    setFotos([]);
    setParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    executar(valor, { texto: '', fotos: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function submit(event: FormEvent) {
    event.preventDefault();
    executar(entrada, { texto, fotos });
  }

  async function adicionarFotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_FOTOS - fotos.length);
    event.target.value = '';
    try {
      const novas = await Promise.all(files.map((f) => resizePhoto(f)));
      setFotos((atual) => [...atual, ...novas].slice(0, MAX_FOTOS));
    } catch {
      setErro('Não foi possível ler uma das fotos. Use JPG, PNG ou WEBP.');
    }
  }

  function mudarUf(value: string) {
    setUf(value);
    saveUf(value);
  }

  const modoAnalise = isUrl(entrada) || texto.trim().length > 0 || fotos.length > 0;

  return (
    <div className="container">
      <TopNav />
      <div className="app-header">
        <h1 className="title">Consulta</h1>
        <p className="app-subtitle">
          Digite o modelo e o ano para o dossiê técnico, ou cole o link do anúncio para a IA vistoriar texto e fotos.
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <input
          className="consulta-input"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Ex.: Jeep Compass 2018  ou  https://www.olx.com.br/…"
          maxLength={2000}
          disabled={loading !== null}
          aria-label="Modelo e ano, ou link do anúncio"
        />
        <div className="consulta-help">
          {isUrl(entrada) && (
            <strong style={{ color: extensao ? 'var(--success)' : 'var(--muted)' }}>
              {extensao ? '🧩 Extensão ativa: o anúncio será lido pelo seu navegador. ' : '🧩 Sem extensão: o servidor tenta ler o link. '}
            </strong>
          )}
          {modoAnalise
            ? '🔍 Análise de anúncio: preço x FIPE, quilometragem pelas fotos, divergências e sinais de golpe + dossiê do modelo.'
            : '📘 Dossiê técnico do modelo: mecânica, defeitos crônicos, custos, FIPE e IPVA.'}
        </div>

        {mostrarTexto && (
          <textarea
            className="consulta-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cole aqui o texto do anúncio: título, preço, km, descrição do vendedor…"
            maxLength={12000}
            disabled={loading !== null}
          />
        )}

        {fotos.length > 0 && (
          <div className="photo-strip">
            {fotos.map((foto, i) => (
              <div key={foto.slice(-40) + i} className="photo-thumb">
                <img src={foto} alt={`Foto ${i + 1}`} />
                <span className="photo-index">{i + 1}</span>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => setFotos((atual) => atual.filter((_, j) => j !== i))}
                  disabled={loading !== null}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="consulta-actions">
          <button type="submit" disabled={loading !== null || (!entrada.trim() && !modoAnalise)}>
            {modoAnalise ? 'Analisar anúncio' : 'Gerar dossiê'}
          </button>
          {!mostrarTexto && (
            <button type="button" className="secondary" onClick={() => setMostrarTexto(true)} disabled={loading !== null}>
              📝 Colar texto do anúncio
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={loading !== null || fotos.length >= MAX_FOTOS}
          >
            📷 Fotos ({fotos.length}/{MAX_FOTOS})
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={adicionarFotos} />
          <select value={uf} onChange={(e) => mudarUf(e.target.value)} disabled={loading !== null} aria-label="Estado para o IPVA">
            {UFS.map((u) => <option key={u} value={u}>IPVA {u}</option>)}
          </select>
        </div>

        {erro && <div className="error" style={{ marginTop: 12 }}>{erro}</div>}
      </form>

      <div style={{ marginTop: 20 }}>
        {loading && <Loading etapas={etapaExtensao ? [etapaExtensao] : loading === 'analise' ? ETAPAS_ANALISE : ETAPAS_DOSSIE} />}
        {!loading && resultado?.tipo === 'dossie' && (
          <div className="dx">
            <DossieView dossie={resultado.dossie} />
            <BuscarOfertas
              key={resultado.dossie.id}
              marca={resultado.dossie.dados.veiculo.marca}
              modelo={resultado.dossie.dados.veiculo.modelo}
              ano={resultado.dossie.dados.veiculo.ano}
              fipe={resultado.dossie.fipe?.faixa ?? null}
              uf={uf}
            />
          </div>
        )}
        {!loading && resultado?.tipo === 'analise' && (
          <div className="dx">
            <AnaliseView analise={resultado.analise} fotosEnviadas={resultado.fotosEnviadas} />
            {resultado.analise.identificacao.marca && resultado.analise.identificacao.modelo && resultado.analise.identificacao.ano_modelo && (
              <BuscarOfertas
                key={resultado.analise.id}
                marca={resultado.analise.identificacao.marca}
                modelo={resultado.analise.identificacao.modelo}
                ano={resultado.analise.identificacao.ano_modelo}
                fipe={resultado.analise.fipe?.faixa ?? null}
                uf={uf}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
