import { parseVehicleModelAndVersion, normalizeVehicleVersion } from '../src/core/cars/utils/vehicle-model-parser';

async function run() {
  const samples: Array<{ brand: string; raw: string }>= [
    { brand: 'BYD', raw: 'Song Plus 1.5 16V Aut. (Hibrido)' },
    { brand: 'Toyota', raw: 'Corolla GLi 1.8 Flex 16V Aut.' },
    { brand: 'Honda', raw: 'HR-V EXL 1.8 Flexone 16V 5p Aut.' },
    { brand: 'Toyota', raw: 'Corolla Cross 1.8 VVT-I Hybrid Flex XRV CVT' },
    { brand: 'Toyota', raw: 'Hilux SW4 2.8 D-4D Turbo Diesel Diamond 7L 4x4 Automatico' },
    { brand: 'BYD', raw: 'Song Plus 1.5 DM-I Híbrido Automático' }
  ];

  for (const s of samples) {
    try {
      const parsed = await parseVehicleModelAndVersion(s.brand, s.raw);
      console.log('---');
      console.log('Brand:', s.brand);
      console.log('Raw:', s.raw);
      console.log('Parsed model:', parsed.model);
      console.log('Parsed version:', parsed.version);
      console.log('Normalized version:', normalizeVehicleVersion(parsed.version));
    } catch (err) {
      console.error('Error parsing', s, err);
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
