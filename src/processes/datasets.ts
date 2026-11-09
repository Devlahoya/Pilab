/**
 * Datos experimentales de ejemplo (sintéticos) para practicar el ajuste.
 *
 * Se generan con correlaciones conocidas de la literatura más un ruido de ±4 %
 * reproducible, así el ajuste debe "redescubrir" la correlación original.
 * Los valores se devuelven en SI, por tipo de magnitud.
 */

export interface ExampleDataset {
  description: string;
  /** Correlación con la que se generaron los datos. */
  source: string;
  rows: Record<string, number>[];
}

/** Ruido multiplicativo reproducible (generador congruencial). */
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return 1 + 0.08 * (s / 4294967296 - 0.5); // ±4 %
  };
}

const rpm = (x: number) => x / 60;

function forcedConvection(): ExampleDataset {
  const rnd = noise(7);
  const fluids = [
    { name: "agua 20 °C", rho: 998, mu: 1.0e-3, k: 0.6, cp: 4182, v: [0.5, 1, 2] },
    { name: "agua 60 °C", rho: 983, mu: 4.67e-4, k: 0.654, cp: 4185, v: [0.5, 1, 2] },
    { name: "glicol 30 %", rho: 1040, mu: 2.0e-3, k: 0.48, cp: 3700, v: [1, 2, 3.5] },
    { name: "aceite ligero", rho: 870, mu: 8.0e-3, k: 0.14, cp: 1900, v: [4, 6, 8] },
  ];
  const D = 0.025;
  const rows = fluids.flatMap((f) =>
    f.v.map((v) => {
      const Re = (f.rho * v * D) / f.mu;
      const Pr = (f.cp * f.mu) / f.k;
      const Nu = 0.023 * Re ** 0.8 * Pr ** 0.4 * rnd();
      return { heat_transfer_coeff: (Nu * f.k) / D, diameter: D, velocity: v, density: f.rho, dynamic_viscosity: f.mu, thermal_conductivity: f.k, specific_heat: f.cp };
    }),
  );
  return {
    description: "12 corridas en un tubo de 25 mm con cuatro fluidos distintos (Pr de 3 a 110) y tres velocidades cada uno.",
    source: "Dittus–Boelter: Nu = 0.023·Re^0.8·Pr^0.4",
    rows,
  };
}

function pipeFlow(): ExampleDataset {
  const rnd = noise(11);
  const rows: Record<string, number>[] = [];
  for (const D of [0.025, 0.05])
    for (const L of [5, 10])
      for (const v of [0.5, 1, 2]) {
        const rho = 998, mu = 1.0e-3;
        const Re = (rho * v * D) / mu;
        const f = 0.316 * Re ** -0.25;
        const dP = f * (L / D) * (rho * v * v) / 2 * rnd();
        rows.push({ pressure_drop: dP, velocity: v, diameter: D, pipe_length: L, roughness: 1.5e-6, density: rho, dynamic_viscosity: mu });
      }
  return {
    description: "12 corridas con agua en tubos lisos: dos diámetros, dos longitudes y tres velocidades.",
    source: "Blasius (tubo liso): f = 0.316·Re^-0.25 ⇒ Eu = 0.158·Re^-0.25·(L/D)",
    rows,
  };
}

function convectiveMass(): ExampleDataset {
  const rnd = noise(5);
  const rows: Record<string, number>[] = [];
  for (const d of [0.005, 0.01])
    for (const v of [0.05, 0.2, 0.5])
      for (const Dab of [1e-9, 2e-9]) {
        const rho = 1000, mu = 1e-3;
        const Re = (rho * v * d) / mu;
        const Sc = mu / (rho * Dab);
        const Sh = (2 + 0.6 * Re ** 0.5 * Sc ** (1 / 3)) * rnd();
        rows.push({ mass_transfer_coeff: (Sh * Dab) / d, diameter: d, velocity: v, density: rho, dynamic_viscosity: mu, diffusivity: Dab });
      }
  return {
    description: "Disolución de esferas de dos tamaños, tres velocidades y dos solutos distintos.",
    source: "Frössling: Sh = 2 + 0.6·Re^½·Sc^⅓ (no es una ley de potencias pura: observa el ajuste)",
    rows,
  };
}

function agitatedPower(): ExampleDataset {
  const rnd = noise(3);
  const rows: Record<string, number>[] = [];
  for (const D of [0.05, 0.08])
    for (const N of [250, 400, 550, 700]) {
      const rho = 1000, mu = 1e-3, n = rpm(N);
      const Po = 5.0 * rnd();
      rows.push({ power: Po * rho * n ** 3 * D ** 5, rotational_speed: n, impeller_diameter: D, tank_diameter: 3 * D, density: rho, dynamic_viscosity: mu, gravity: 9.81 });
    }
  return {
    description: "Dos turbinas Rushton geométricamente semejantes (D_t = 3D) a cuatro velocidades, en régimen turbulento.",
    source: "Rushton turbulento: Po ≈ 5, independiente de Re y Fr",
    rows,
  };
}

function bioreactorKla(): ExampleDataset {
  const rnd = noise(13);
  const rows: Record<string, number>[] = [];
  for (const D of [0.05, 0.08])
    for (const N of [300, 500, 700])
      for (const QgLmin of [2, 5]) {
        const rho = 1000, n = rpm(N);
        const Dt = 3 * D;
        const V = (Math.PI / 4) * Dt * Dt * Dt;
        const P = 5 * rho * n ** 3 * D ** 5;
        const Qg = QgLmin / 1000 / 60;
        const vs = Qg / ((Math.PI / 4) * Dt * Dt);
        const kla = 0.026 * (P / V) ** 0.4 * vs ** 0.5 * rnd(); // van't Riet (agua, sin electrolitos)
        rows.push({ kla, rotational_speed: n, impeller_diameter: D, density: rho, dynamic_viscosity: 1e-3, surface_tension: 0.072, diffusivity: 2.1e-9, gas_flow: Qg, gravity: 9.81 });
      }
  return {
    description: "12 corridas: dos tamaños de biorreactor, tres velocidades de agitación y dos flujos de aire, con el mismo medio.",
    source: "van't Riet (agua): kLa = 0.026·(P/V)^0.4·v_s^0.5",
    rows,
  };
}

export const EXAMPLE_DATASETS: Record<string, () => ExampleDataset> = {
  "forced-convection": forcedConvection,
  "pipe-flow": pipeFlow,
  "convective-mass": convectiveMass,
  "agitated-power": agitatedPower,
  "bioreactor-kla": bioreactorKla,
};
