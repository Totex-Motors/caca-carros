import type { CarDTO } from '@caca/shared/types/car';

function formatNumber(value: number | null, suffix = ''): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR')}${suffix}`;
}

export function CarList(props: { cars: CarDTO[] }) {
  if (!props.cars.length) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        color: 'var(--muted)',
        fontSize: 14,
        background: 'linear-gradient(145deg, #f8fdff, #f0f9ff)',
        borderRadius: 18,
        border: '1.5px dashed rgba(8, 145, 178, 0.2)'
      }}>
        Nenhum anúncio encontrado ainda.
      </div>
    );
  }

  return (
    <div className="row">
      {props.cars.map((car) => {
        const photo = car.photos[0];
        return (
          <div key={car.url} className="card" style={{ flex: '1 1 290px', padding: 16 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {photo ? (
                <img
                  src={photo}
                  alt={car.title}
                  referrerPolicy="no-referrer"
                  style={{
                    width: 100,
                    height: 76,
                    objectFit: 'cover',
                    borderRadius: 14,
                    border: '1.5px solid rgba(8, 145, 178, 0.12)',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(8, 145, 178, 0.10)'
                  }}
                />
              ) : (
                <div style={{
                  width: 100,
                  height: 76,
                  borderRadius: 14,
                  border: '1.5px dashed rgba(8, 145, 178, 0.2)',
                  background: 'linear-gradient(145deg, #f0f9ff, #e0f7fa)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Sem foto
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{car.title}</span>
                  {car.portal && (
                    <span className="portal-badge">{car.portal}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  {car.year && (
                    <span className="muted" style={{ fontSize: 11 }}>📅 {car.year}</span>
                  )}
                  <span className="muted" style={{ fontSize: 11 }}>
                    0 {formatNumber(car.km, ' km')}
                  </span>
                  {car.fuel_type && (
                    <span className="muted" style={{ fontSize: 11 }}>⛽ {car.fuel_type}</span>
                  )}
                  {car.transmission && (
                    <span className="muted" style={{ fontSize: 11 }}>⚙️ {car.transmission}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary-dark)' }}>
                    {car.price > 0 ? (
                      `R$ ${car.price.toLocaleString('pt-BR')}`
                    ) : (
                      <span className="muted" style={{ fontWeight: 600 }}>Sob consulta</span>
                    )}
                  </div>
                  <a
                    href={car.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#fff',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      boxShadow: '0 3px 10px rgba(8, 145, 178, 0.28)',
                      textDecoration: 'none',
                      display: 'inline-block',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                  >
                    Ver anúncio →
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
