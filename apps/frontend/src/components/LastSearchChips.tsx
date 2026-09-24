import type { LastSearchDTO } from '@caca/shared/types/car';

const ICONE = { ok: '✅', vazio: '∅', erro: '⚠️', nao_configurado: '🔧' } as const;

/** Resultado da ultima busca automatica em cada portal (explica por que nada apareceu). */
export function LastSearchChips({ lastSearch }: { lastSearch: LastSearchDTO | null | undefined }) {
  if (!lastSearch) return null;
  const entradas = Object.entries(lastSearch.portais);
  const naoConfigurados = entradas.filter(([, p]) => p.status === 'nao_configurado');
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Última busca {new Date(lastSearch.finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}:
        </span>
        {entradas.map(([portal, p]) => {
          const texto =
            p.status === 'ok' ? `${p.count} anúncio(s)` : p.status === 'vazio' ? 'nada encontrado' : p.status === 'erro' ? 'falhou' : 'não configurado';
          return (
            <span key={portal} title={p.mensagem ?? ''} className={`search-chip ${p.status}`}>
              {ICONE[p.status]} {portal}: {texto}
            </span>
          );
        })}
      </div>
      {naoConfigurados.length > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          🔧 {Array.from(new Set(naoConfigurados.map(([, p]) => p.mensagem))).join(' ')}
        </div>
      )}
    </div>
  );
}
