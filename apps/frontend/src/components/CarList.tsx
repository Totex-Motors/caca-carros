import type { CarDTO } from '@caca/shared/types/car';

function formatNumber(value: number | null, suffix = ''): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR')}${suffix}`;
}


export function CarList(props: { cars: CarDTO[] }) {
  if (!props.cars.length) {
    return <div className="muted">Nenhum anuncio encontrado ainda.</div>;
  }

  return (
    <div className="row">
      {props.cars.map((car) => {
        const photo = car.photos[0];
        return (
          <div key={car.url} className="card" style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {photo ? (
                <img
                  src={photo}
                  alt={car.title}
                  referrerPolicy="no-referrer"
                  style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 72,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Sem foto
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{car.title}</span>
                  {car.portal && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {car.portal}
                    </span>
                  )}
                </div>
                <div className="muted">Ano: {car.year}</div>
                <div className="muted">
                  KM: {formatNumber(car.km)} • Comb.: {car.fuel_type ?? '—'} • Cambio: {car.transmission ?? '—'}
                </div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>
                  {car.price > 0 ? `R$ ${car.price.toLocaleString('pt-BR')}` : <span className="muted">Sem preço</span>}
                </div>
                <div style={{ marginTop: 6 }}>
                  <a href={car.url} target="_blank" rel="noreferrer">Ver anuncio</a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
