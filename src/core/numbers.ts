/**
 * Biblioteca de números adimensionales con nombre.
 *
 * Cada definición expresa el número como producto de magnitudes elevadas a
 * exponentes. Las claves pueden ser un tipo de magnitud (`impeller_diameter`)
 * o una familia (`length` = cualquier longitud característica).
 *
 * El orden del arreglo importa: al construir la relación final se prefieren
 * los números que aparecen primero.
 */

export type NumberArea =
  | "Mecánica de fluidos"
  | "Agitación y bombeo"
  | "Partículas, gotas y burbujas"
  | "Transferencia de calor"
  | "Transferencia de masa"
  | "Reacción y bioprocesos";

export interface Regime {
  label: string;
  tone: "info" | "ok" | "warn";
}

export interface DimensionlessNumber {
  id: string;
  symbol: string;
  name: string;
  area: NumberArea;
  /** Significado físico como cociente de efectos. */
  meaning: string;
  /** Fórmula legible. */
  formula: string;
  definitions: Record<string, number>[];
  interpret?: (value: number) => Regime | null;
  notes?: string;
}

const fmt = (x: number) => x.toLocaleString("es-MX");

export const NUMBERS: DimensionlessNumber[] = [
  // ───────────── Agitación y bombeo
  {
    id: "Po", symbol: "Po", name: "Número de potencia", area: "Agitación y bombeo",
    meaning: "Potencia consumida / fuerzas inerciales del impulsor",
    formula: "P / (ρ N³ D⁵)",
    definitions: [{ power: 1, density: -1, rotational_speed: -3, impeller_diameter: -5 }],
    notes: "En régimen turbulento es casi constante: ≈5 para turbina Rushton, ≈0.3–1.5 para hélices y turbinas de flujo axial.",
  },
  {
    id: "Re_a", symbol: "Re", name: "Reynolds de agitación", area: "Agitación y bombeo",
    meaning: "Fuerzas inerciales / fuerzas viscosas en el impulsor",
    formula: "ρ N D² / μ",
    definitions: [
      { density: 1, rotational_speed: 1, impeller_diameter: 2, dynamic_viscosity: -1 },
      { rotational_speed: 1, impeller_diameter: 2, kinematic_viscosity: -1 },
    ],
    interpret: (v) =>
      v < 10 ? { label: "Laminar (Re < 10)", tone: "info" }
      : v < 1e4 ? { label: "Transición (10 – 10⁴)", tone: "warn" }
      : { label: "Turbulento (Re > 10⁴)", tone: "ok" },
  },
  {
    id: "Fr_a", symbol: "Fr", name: "Froude de agitación", area: "Agitación y bombeo",
    meaning: "Fuerzas inerciales / fuerzas gravitacionales (formación de vórtice)",
    formula: "N² D / g",
    definitions: [{ rotational_speed: 2, impeller_diameter: 1, gravity: -1 }],
    notes: "Importa en tanques sin deflectores, donde se forma vórtice.",
  },
  {
    id: "Fl", symbol: "Fl", name: "Número de aireación / coeficiente de flujo", area: "Agitación y bombeo",
    meaning: "Caudal / capacidad de bombeo del impulsor",
    formula: "Q / (N D³)",
    definitions: [{ flow: 1, rotational_speed: -1, impeller_diameter: -3 }],
    notes: "En biorreactores, valores altos de Fl llevan a la inundación del impulsor (flooding). En bombas se conoce como φ.",
  },
  {
    id: "psi", symbol: "ψ", name: "Coeficiente de carga", area: "Agitación y bombeo",
    meaning: "Energía entregada al fluido / energía cinética del rodete",
    formula: "ΔP / (ρ N² D²)  ó  gH / (N² D²)",
    definitions: [
      { pressure: 1, density: -1, rotational_speed: -2, impeller_diameter: -2 },
      { gravity: 1, head: 1, rotational_speed: -2, impeller_diameter: -2 },
    ],
  },
  {
    id: "N_theta", symbol: "N·θₘ", name: "Tiempo de mezclado adimensional", area: "Agitación y bombeo",
    meaning: "Número de revoluciones necesarias para homogeneizar",
    formula: "N θₘ",
    definitions: [{ rotational_speed: 1, mixing_time: 1 }],
    notes: "En régimen turbulento es aproximadamente constante para una geometría dada.",
  },
  {
    id: "We_a", symbol: "We", name: "Weber de agitación", area: "Agitación y bombeo",
    meaning: "Fuerzas inerciales / tensión superficial (ruptura de burbujas y gotas)",
    formula: "ρ N² D³ / σ",
    definitions: [{ density: 1, rotational_speed: 2, impeller_diameter: 3, surface_tension: -1 }],
  },
  {
    id: "kLa_N", symbol: "kLa/N", name: "kLa adimensional", area: "Reacción y bioprocesos",
    meaning: "Rapidez de transferencia de oxígeno / rapidez de agitación",
    formula: "k_La / N",
    definitions: [{ kla: 1, rotational_speed: -1 }],
  },

  // ───────────── Mecánica de fluidos
  {
    id: "Re", symbol: "Re", name: "Número de Reynolds", area: "Mecánica de fluidos",
    meaning: "Fuerzas inerciales / fuerzas viscosas",
    formula: "ρ v L / μ",
    definitions: [
      { density: 1, velocity: 1, length: 1, dynamic_viscosity: -1 },
      { velocity: 1, length: 1, kinematic_viscosity: -1 },
    ],
    interpret: (v) =>
      v < 2300 ? { label: "Laminar en tubería (Re < 2300)", tone: "info" }
      : v < 4000 ? { label: "Transición (2300 – 4000)", tone: "warn" }
      : { label: "Turbulento en tubería (Re > 4000)", tone: "ok" },
    notes: "Los límites de régimen dependen de la geometría; los mostrados son para flujo en tubería.",
  },
  {
    id: "Eu", symbol: "Eu", name: "Número de Euler", area: "Mecánica de fluidos",
    meaning: "Fuerzas de presión / fuerzas inerciales",
    formula: "ΔP / (ρ v²)",
    definitions: [{ pressure: 1, density: -1, velocity: -2 }],
    notes: "El factor de fricción de Darcy es f = 2·Eu·(D/L).",
  },
  {
    id: "Cd", symbol: "C_D", name: "Coeficiente de arrastre", area: "Mecánica de fluidos",
    meaning: "Fuerza de arrastre / presión dinámica × área",
    formula: "F / (ρ v² L²)",
    definitions: [{ force: 1, density: -1, velocity: -2, length: -2 }],
    notes: "La definición clásica es C_D = F/(½ρv²A); difiere sólo en una constante.",
  },
  {
    id: "Fr", symbol: "Fr", name: "Número de Froude", area: "Mecánica de fluidos",
    meaning: "Fuerzas inerciales / fuerzas gravitacionales",
    formula: "v² / (g L)",
    definitions: [{ velocity: 2, gravity: -1, length: -1 }],
  },
  {
    id: "St", symbol: "Sr", name: "Número de Strouhal", area: "Mecánica de fluidos",
    meaning: "Frecuencia de oscilación / frecuencia del flujo",
    formula: "f L / v",
    definitions: [{ frequency: 1, length: 1, velocity: -1 }],
  },

  // ───────────── Partículas, gotas y burbujas
  {
    id: "Ar", symbol: "Ar", name: "Número de Arquímedes", area: "Partículas, gotas y burbujas",
    meaning: "Fuerzas de flotación / fuerzas viscosas",
    formula: "g L³ ρ Δρ / μ²",
    definitions: [{ gravity: 1, length: 3, density: 1, density_difference: 1, dynamic_viscosity: -2 }],
  },
  {
    id: "Eo", symbol: "Eo", name: "Número de Eötvös (Bond)", area: "Partículas, gotas y burbujas",
    meaning: "Fuerzas de flotación / tensión superficial",
    formula: "Δρ g L² / σ",
    definitions: [{ density_difference: 1, gravity: 1, length: 2, surface_tension: -1 }],
  },
  {
    id: "Mo", symbol: "Mo", name: "Número de Morton", area: "Partículas, gotas y burbujas",
    meaning: "Propiedades del sistema (sólo depende de los fluidos)",
    formula: "g μ⁴ Δρ / (ρ² σ³)",
    definitions: [{ gravity: 1, dynamic_viscosity: 4, density_difference: 1, density: -2, surface_tension: -3 }],
  },
  {
    id: "We", symbol: "We", name: "Número de Weber", area: "Partículas, gotas y burbujas",
    meaning: "Fuerzas inerciales / tensión superficial",
    formula: "ρ v² L / σ",
    definitions: [{ density: 1, velocity: 2, length: 1, surface_tension: -1 }],
  },
  {
    id: "Ca", symbol: "Ca", name: "Número capilar", area: "Partículas, gotas y burbujas",
    meaning: "Fuerzas viscosas / tensión superficial",
    formula: "μ v / σ",
    definitions: [{ dynamic_viscosity: 1, velocity: 1, surface_tension: -1 }],
  },
  {
    id: "Ga", symbol: "Ga", name: "Número de Galileo", area: "Partículas, gotas y burbujas",
    meaning: "Fuerzas gravitacionales / fuerzas viscosas",
    formula: "g L³ ρ² / μ²",
    definitions: [
      { gravity: 1, length: 3, density: 2, dynamic_viscosity: -2 },
      { gravity: 1, length: 3, kinematic_viscosity: -2 },
    ],
  },

  // ───────────── Transferencia de calor
  {
    id: "Nu", symbol: "Nu", name: "Número de Nusselt", area: "Transferencia de calor",
    meaning: "Transferencia de calor por convección / por conducción",
    formula: "h L / k",
    definitions: [{ heat_transfer_coeff: 1, length: 1, thermal_conductivity: -1 }],
  },
  {
    id: "Pr", symbol: "Pr", name: "Número de Prandtl", area: "Transferencia de calor",
    meaning: "Difusividad de momento / difusividad térmica",
    formula: "c_p μ / k",
    definitions: [
      { specific_heat: 1, dynamic_viscosity: 1, thermal_conductivity: -1 },
      { kinematic_viscosity: 1, thermal_diffusivity: -1 },
    ],
    interpret: (v) =>
      v < 0.1 ? { label: "Metales líquidos (Pr ≪ 1)", tone: "info" }
      : v < 2 ? { label: "Gases (Pr ≈ 0.7)", tone: "info" }
      : v < 20 ? { label: "Agua y líquidos ligeros", tone: "info" }
      : { label: "Aceites / líquidos viscosos (Pr ≫ 1)", tone: "info" },
  },
  {
    id: "Gr", symbol: "Gr", name: "Número de Grashof", area: "Transferencia de calor",
    meaning: "Fuerzas de flotación / fuerzas viscosas (convección natural)",
    formula: "g β ΔT L³ ρ² / μ²",
    definitions: [
      { gravity: 1, thermal_expansion: 1, temperature_difference: 1, length: 3, density: 2, dynamic_viscosity: -2 },
      { gravity: 1, thermal_expansion: 1, temperature_difference: 1, length: 3, kinematic_viscosity: -2 },
    ],
  },
  {
    id: "Ra", symbol: "Ra", name: "Número de Rayleigh", area: "Transferencia de calor",
    meaning: "Gr · Pr — intensidad de la convección natural",
    formula: "g β ΔT L³ ρ² c_p / (μ k)",
    definitions: [
      { gravity: 1, thermal_expansion: 1, temperature_difference: 1, length: 3, density: 2, specific_heat: 1, dynamic_viscosity: -1, thermal_conductivity: -1 },
      { gravity: 1, thermal_expansion: 1, temperature_difference: 1, length: 3, kinematic_viscosity: -1, thermal_diffusivity: -1 },
    ],
    interpret: (v) =>
      v < 1e9 ? { label: "Convección natural laminar (Ra < 10⁹)", tone: "info" } : { label: "Convección natural turbulenta (Ra > 10⁹)", tone: "ok" },
  },
  {
    id: "Pe", symbol: "Pe", name: "Número de Péclet (térmico)", area: "Transferencia de calor",
    meaning: "Transporte de calor por convección / por conducción",
    formula: "ρ c_p v L / k",
    definitions: [
      { density: 1, specific_heat: 1, velocity: 1, length: 1, thermal_conductivity: -1 },
      { velocity: 1, length: 1, thermal_diffusivity: -1 },
    ],
  },
  {
    id: "StH", symbol: "St", name: "Número de Stanton", area: "Transferencia de calor",
    meaning: "Calor transferido / capacidad térmica del flujo",
    formula: "h / (ρ c_p v)",
    definitions: [{ heat_transfer_coeff: 1, density: -1, specific_heat: -1, velocity: -1 }],
  },
  {
    id: "Bi", symbol: "Bi", name: "Número de Biot", area: "Transferencia de calor",
    meaning: "Resistencia interna (conducción) / resistencia externa (convección)",
    formula: "h L / k_s",
    definitions: [{ heat_transfer_coeff: 1, length: 1, solid_thermal_conductivity: -1 }],
    interpret: (v) =>
      v < 0.1 ? { label: "Bi < 0.1: temperatura uniforme en el sólido", tone: "ok" } : { label: "Bi > 0.1: hay gradientes internos", tone: "warn" },
  },
  {
    id: "Fo", symbol: "Fo", name: "Número de Fourier", area: "Transferencia de calor",
    meaning: "Tiempo transcurrido / tiempo de difusión del calor",
    formula: "α t / L²",
    definitions: [
      { thermal_diffusivity: 1, time: 1, length: -2 },
      { thermal_conductivity: 1, time: 1, density: -1, specific_heat: -1, length: -2 },
    ],
  },
  {
    id: "betaDT", symbol: "βΔT", name: "Parámetro de expansión térmica", area: "Transferencia de calor",
    meaning: "Cambio relativo de densidad causado por la diferencia de temperatura",
    formula: "β ΔT",
    definitions: [{ thermal_expansion: 1, temperature_difference: 1 }],
    notes: "En la aproximación de Boussinesq βΔT ≪ 1 y suele omitirse.",
  },
  {
    id: "Di", symbol: "Di", name: "Número de disipación", area: "Transferencia de calor",
    meaning: "Calentamiento por compresión / capacidad térmica",
    formula: "g β L / c_p",
    definitions: [{ gravity: 1, thermal_expansion: 1, length: 1, specific_heat: -1 }],
    notes: "Suele ser despreciable en convección natural de laboratorio y equipos.",
  },

  // ───────────── Transferencia de masa
  {
    id: "Sh", symbol: "Sh", name: "Número de Sherwood", area: "Transferencia de masa",
    meaning: "Transferencia de masa por convección / por difusión",
    formula: "k_L L / D_AB",
    definitions: [{ mass_transfer_coeff: 1, length: 1, diffusivity: -1 }],
  },
  {
    id: "Sh_v", symbol: "Sh_v", name: "Sherwood volumétrico", area: "Transferencia de masa",
    meaning: "kLa referido a la difusión molecular",
    formula: "k_La L² / D_AB",
    definitions: [{ kla: 1, length: 2, diffusivity: -1 }],
  },
  {
    id: "Sc", symbol: "Sc", name: "Número de Schmidt", area: "Transferencia de masa",
    meaning: "Difusividad de momento / difusividad de masa",
    formula: "μ / (ρ D_AB)",
    definitions: [
      { dynamic_viscosity: 1, density: -1, diffusivity: -1 },
      { kinematic_viscosity: 1, diffusivity: -1 },
    ],
    interpret: (v) =>
      v < 10 ? { label: "Típico de gases (Sc ≈ 1)", tone: "info" } : { label: "Típico de líquidos (Sc ≈ 10²–10³)", tone: "info" },
  },
  {
    id: "PeM", symbol: "Pe_m", name: "Péclet másico", area: "Transferencia de masa",
    meaning: "Transporte de masa por convección / por difusión",
    formula: "v L / D_AB",
    definitions: [{ velocity: 1, length: 1, diffusivity: -1 }],
  },
  {
    id: "Le", symbol: "Le", name: "Número de Lewis", area: "Transferencia de masa",
    meaning: "Difusividad térmica / difusividad de masa",
    formula: "k / (ρ c_p D_AB)",
    definitions: [
      { thermal_conductivity: 1, density: -1, specific_heat: -1, diffusivity: -1 },
      { thermal_diffusivity: 1, diffusivity: -1 },
    ],
  },
  {
    id: "StM", symbol: "St_m", name: "Stanton másico", area: "Transferencia de masa",
    meaning: "Masa transferida / masa transportada por el flujo",
    formula: "k_L / v",
    definitions: [{ mass_transfer_coeff: 1, velocity: -1 }],
  },
  {
    id: "FoM", symbol: "Fo_m", name: "Fourier másico", area: "Transferencia de masa",
    meaning: "Tiempo transcurrido / tiempo de difusión de masa",
    formula: "D_AB t / L²",
    definitions: [{ diffusivity: 1, time: 1, length: -2 }],
  },

  // ───────────── Reacción y bioprocesos
  {
    id: "Da", symbol: "Da", name: "Número de Damköhler (I)", area: "Reacción y bioprocesos",
    meaning: "Rapidez de reacción / rapidez de transporte por flujo",
    formula: "k_r τ  ó  k_r L / v",
    definitions: [
      { reaction_rate_constant: 1, time: 1 },
      { reaction_rate_constant: 1, length: 1, velocity: -1 },
    ],
    interpret: (v) =>
      v < 0.1 ? { label: "Reacción lenta frente al flujo", tone: "info" }
      : v > 10 ? { label: "Reacción rápida: controla el transporte", tone: "info" }
      : { label: "Reacción y transporte comparables", tone: "warn" },
  },
  {
    id: "mu_kla", symbol: "μₓ/k_La", name: "Crecimiento / transferencia de O₂", area: "Reacción y bioprocesos",
    meaning: "Rapidez de crecimiento celular / rapidez de transferencia de oxígeno",
    formula: "μₓ / k_La",
    definitions: [{ growth_rate: 1, kla: -1 }],
  },
];

export const NUMBER_BY_ID: Record<string, DimensionlessNumber> = Object.fromEntries(NUMBERS.map((n) => [n.id, n]));

export const NUMBER_AREAS: NumberArea[] = [
  "Mecánica de fluidos",
  "Agitación y bombeo",
  "Partículas, gotas y burbujas",
  "Transferencia de calor",
  "Transferencia de masa",
  "Reacción y bioprocesos",
];

export { fmt as formatNumberEs };
