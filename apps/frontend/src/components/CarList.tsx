import type { CarDTO } from '@caca/shared/types/car';

export function CarList(props: { cars: CarDTO[] }) {
  if (!props.cars.length) {
    return <div className="muted">Nenhum anúncio encontrado ainda.</div>;
  }

  return (
    <div className="row">
      {props.cars.map((car) => (
        <div key={car.id} className="card" style={{ flex: '1 1 280px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {car.image ? (
              <img
                src={car.image}
                alt={`${car.brand} ${car.model}`}
                style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
            ) : (
              <div style={{ width: 96, height: 72, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{car.brand} {car.model}</div>
              <div className="muted">Ano: {car.year}</div>
              <div className="muted">KM: {car.mileage ?? '—'} • Comb.: {car.fuel ?? '—'}</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>R$ {car.price.toLocaleString('pt-BR')}</div>
              <div style={{ marginTop: 6 }}>
                <a href={car.url} target="_blank" rel="noreferrer">Ver anúncio</a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
