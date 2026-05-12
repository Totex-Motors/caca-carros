import type { CarDTO } from '@caca/shared/types/car';

function formatNumber(value: number | null, suffix = ''): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR')}${suffix}`;
}

function formatLocation(city: string | null, state: string | null): string {
  if (city && state) return `${city} • ${state}`;
  if (city) return city;
  if (state) return state;
  return '—';
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
                <div style={{ fontWeight: 700 }}>{car.title}</div>
                <div className="muted">Ano: {car.year}</div>
                <div className="muted">
                  KM: {formatNumber(car.km)} • Comb.: {car.fuel_type ?? '—'} • Cambio: {car.transmission ?? '—'}
                </div>
                <div className="muted">Local: {formatLocation(car.city, car.state)}</div>
                <div style={{ marginTop: 6, fontWeight: 700 }}>R$ {car.price.toLocaleString('pt-BR')}</div>
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
