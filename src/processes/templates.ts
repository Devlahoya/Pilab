/**
 * Plantillas de procesos.
 *
 * Una plantilla sólo es una lista de variables relevantes con valores de
 * ejemplo; el análisis es siempre el mismo motor genérico. Agregar un proceso
 * nuevo = agregar un objeto a este arreglo.
 */

export type ProcessArea =
  | "Biorreactores y agitación"
  | "Flujo de fluidos y bombeo"
  | "Partículas y burbujas"
  | "Transferencia de calor"
  | "Transferencia de masa y reacción"
  | "Ejemplos didácticos";

export interface TemplateVariable {
  kind: string;
  symbol?: string;
  name?: string;
  unit?: string;
  value?: number;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  area: ProcessArea;
  icon: string;
  description: string;
  /** Relación que se espera obtener (para orientar al usuario). */
  expected: string;
  /** Índice de la variable de interés. */
  dependent: number;
  variables: TemplateVariable[];
  /** Números preferidos al construir la relación (ids de la biblioteca o símbolos de relaciones). */
  preferred?: string[];
  /** Correlaciones típicas o comentarios de ingeniería. */
  tip?: string;
}

export const PROCESS_AREAS: ProcessArea[] = [
  "Biorreactores y agitación",
  "Flujo de fluidos y bombeo",
  "Partículas y burbujas",
  "Transferencia de calor",
  "Transferencia de masa y reacción",
  "Ejemplos didácticos",
];

export const TEMPLATES: ProcessTemplate[] = [
  // ───────────────────────── Biorreactores y agitación
  {
    id: "agitated-power",
    name: "Potencia en tanque agitado",
    area: "Biorreactores y agitación",
    icon: "🌀",
    description: "Consumo de potencia de un impulsor en un tanque con deflectores, sin aireación.",
    expected: "Po = f(Re, Fr, D_t/D)",
    dependent: 0,
    variables: [
      { kind: "power", value: 1.15 },
      { kind: "rotational_speed", value: 400 },
      { kind: "impeller_diameter", value: 0.06 },
      { kind: "tank_diameter", value: 0.18 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "gravity", value: 9.81 },
    ],
    preferred: ["Po", "Re_a", "Fr_a"],
    tip: "Para turbina Rushton en régimen turbulento Po ≈ 5. Un criterio clásico de escalamiento es mantener P/V constante.",
  },
  {
    id: "aerated-power",
    name: "Biorreactor aireado: potencia",
    area: "Biorreactores y agitación",
    icon: "🫧",
    description: "Potencia con aireación (P_g) en un biorreactor de tanque agitado.",
    expected: "Po = f(Re, Fr, Fl, D_t/D)",
    dependent: 0,
    variables: [
      { kind: "power", symbol: "P_g", name: "Potencia con aireación", value: 0.6 },
      { kind: "rotational_speed", value: 400 },
      { kind: "impeller_diameter", value: 0.06 },
      { kind: "tank_diameter", value: 0.18 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "gravity", value: 9.81 },
      { kind: "gas_flow", value: 5 },
    ],
    preferred: ["Po", "Re_a", "Fr_a", "Fl"],
    tip: "La aireación reduce la potencia: P_g/P disminuye al aumentar el número de aireación Fl (correlaciones de Michel–Miller, Hughmark).",
  },
  {
    id: "bioreactor-kla",
    name: "Biorreactor: transferencia de oxígeno (kLa)",
    area: "Biorreactores y agitación",
    icon: "🧫",
    description: "Coeficiente volumétrico de transferencia de oxígeno en un tanque agitado y aireado.",
    expected: "kLa/N = f(Re, Fr, Fl, We, Sc)",
    dependent: 0,
    variables: [
      { kind: "kla", value: 60 },
      { kind: "rotational_speed", value: 400 },
      { kind: "impeller_diameter", value: 0.06 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "surface_tension", value: 0.072 },
      { kind: "diffusivity", name: "Difusividad del O₂ en el medio", value: 2.1e-9 },
      { kind: "gas_flow", value: 5 },
      { kind: "gravity", value: 9.81 },
    ],
    preferred: ["kLa_N", "Re_a", "Fr_a", "Fl", "We_a", "Sc"],
    tip: "Las correlaciones de tipo van't Riet, kLa = C·(Pg/V)^α·(vs)^β, son casos particulares de esta relación adimensional.",
  },
  {
    id: "mixing-time",
    name: "Tiempo de mezclado",
    area: "Biorreactores y agitación",
    icon: "⏱️",
    description: "Tiempo para homogeneizar el contenido de un tanque agitado.",
    expected: "N·θₘ = f(Re, D_t/D)",
    dependent: 0,
    variables: [
      { kind: "mixing_time", value: 8 },
      { kind: "rotational_speed", value: 400 },
      { kind: "impeller_diameter", value: 0.06 },
      { kind: "tank_diameter", value: 0.18 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
    ],
    preferred: ["N_theta", "Re_a"],
    tip: "En régimen turbulento N·θₘ es prácticamente constante para una geometría: al escalar con P/V constante el tiempo de mezclado aumenta.",
  },

  // ───────────────────────── Flujo de fluidos y bombeo
  {
    id: "pipe-flow",
    name: "Caída de presión en tubería",
    area: "Flujo de fluidos y bombeo",
    icon: "🚰",
    description: "Pérdida de presión por fricción en una tubería recta.",
    expected: "Eu = f(Re, L/D, ε/D)",
    dependent: 0,
    variables: [
      { kind: "pressure_drop", value: 2250 },
      { kind: "velocity", value: 1 },
      { kind: "diameter", value: 0.05 },
      { kind: "pipe_length", value: 10 },
      { kind: "roughness", value: 0.045 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
    ],
    preferred: ["Eu", "Re"],
    tip: "Es la base del diagrama de Moody: el factor de Darcy f = 2·Eu·(D/L) depende sólo de Re y ε/D (ecuación de Colebrook).",
  },
  {
    id: "centrifugal-pump",
    name: "Bomba centrífuga",
    area: "Flujo de fluidos y bombeo",
    icon: "⚙️",
    description: "Aumento de presión entregado por una bomba centrífuga.",
    expected: "ψ = f(Fl, Re)",
    dependent: 0,
    variables: [
      { kind: "pressure_drop", name: "Aumento de presión", value: 200000 },
      { kind: "volumetric_flow", value: 30 },
      { kind: "rotational_speed", value: 1750 },
      { kind: "impeller_diameter", name: "Diámetro del rodete", value: 0.25 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
    ],
    preferred: ["psi", "Fl", "Re_a"],
    tip: "Leyes de afinidad: con φ constante se cumple Q ∝ N·D³, ΔP ∝ N²·D² y P ∝ N³·D⁵.",
  },

  // ───────────────────────── Partículas y burbujas
  {
    id: "sphere-drag",
    name: "Arrastre sobre una esfera",
    area: "Partículas y burbujas",
    icon: "⚪",
    description: "Fuerza que ejerce un fluido sobre una partícula esférica.",
    expected: "C_D = f(Re)",
    dependent: 0,
    variables: [
      { kind: "drag_force", value: 5.4e-5 },
      { kind: "velocity", value: 0.1 },
      { kind: "particle_diameter", value: 5 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
    ],
    preferred: ["Cd", "Re"],
    tip: "Régimen de Stokes (Re < 1): C_D = 24/Re usando la definición con ½ρv²A.",
  },
  {
    id: "settling",
    name: "Sedimentación de partículas",
    area: "Partículas y burbujas",
    icon: "⏬",
    description: "Velocidad terminal de una partícula sólida que cae en un líquido.",
    expected: "Re = f(Ar, Δρ/ρ)",
    dependent: 0,
    variables: [
      { kind: "terminal_velocity", value: 0.02 },
      { kind: "particle_diameter", value: 0.2 },
      { kind: "density", value: 1000 },
      { kind: "density_difference", value: 1650 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "gravity", value: 9.81 },
    ],
    preferred: ["Re", "Ar", "Δρ/ρ"],
    tip: "Correlaciones Re = f(Ar) (p. ej. Haider–Levenspiel) permiten calcular v_t sin iterar.",
  },
  {
    id: "bubble-rise",
    name: "Ascenso de burbujas",
    area: "Partículas y burbujas",
    icon: "🫧",
    description: "Velocidad de ascenso de una burbuja de gas en un líquido (aireación, columnas de burbujeo).",
    expected: "Re = f(Eo, Mo, Δρ/ρ)",
    dependent: 0,
    variables: [
      { kind: "terminal_velocity", symbol: "v_b", name: "Velocidad de ascenso", value: 0.23 },
      { kind: "particle_diameter", symbol: "d_b", name: "Diámetro de burbuja", value: 3 },
      { kind: "density", value: 1000 },
      { kind: "density_difference", value: 999 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "surface_tension", value: 0.072 },
      { kind: "gravity", value: 9.81 },
    ],
    preferred: ["Re", "Eo", "Mo", "Δρ/ρ"],
    tip: "Es la base del diagrama de Grace (forma y velocidad de burbujas y gotas).",
  },

  // ───────────────────────── Transferencia de calor
  {
    id: "forced-convection",
    name: "Convección forzada en un tubo",
    area: "Transferencia de calor",
    icon: "🔥",
    description: "Coeficiente de transferencia de calor de un fluido que circula por un tubo.",
    expected: "Nu = f(Re, Pr)",
    dependent: 0,
    variables: [
      { kind: "heat_transfer_coeff", value: 3900 },
      { kind: "diameter", value: 0.025 },
      { kind: "velocity", value: 1 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "thermal_conductivity", value: 0.6 },
      { kind: "specific_heat", value: 4180 },
    ],
    preferred: ["Nu", "Re", "Pr"],
    tip: "Dittus–Boelter (turbulento): Nu = 0.023·Re^0.8·Pr^n, n = 0.4 al calentar y 0.3 al enfriar.",
  },
  {
    id: "natural-convection",
    name: "Convección natural en placa vertical",
    area: "Transferencia de calor",
    icon: "♨️",
    description: "Transferencia de calor por flotación en aire junto a una placa caliente.",
    expected: "Nu = f(Gr, Pr, βΔT, Di)",
    dependent: 0,
    variables: [
      { kind: "heat_transfer_coeff", value: 4 },
      { kind: "char_length", name: "Altura de la placa", value: 0.5 },
      { kind: "gravity", value: 9.81 },
      { kind: "thermal_expansion", value: 0.0033 },
      { kind: "temperature_difference", value: 20 },
      { kind: "density", value: 1.16 },
      { kind: "dynamic_viscosity", value: 1.85e-5 },
      { kind: "thermal_conductivity", value: 0.026 },
      { kind: "specific_heat", value: 1007 },
    ],
    preferred: ["Nu", "Gr", "Pr", "betaDT", "Di"],
    tip: "Con la aproximación de Boussinesq (βΔT y Di despreciables) queda Nu = f(Gr, Pr) = C·Ra^n (Churchill–Chu).",
  },
  {
    id: "transient-conduction",
    name: "Enfriamiento de un sólido",
    area: "Transferencia de calor",
    icon: "🧊",
    description: "Conducción transitoria: temperatura adimensional de un sólido que se enfría por convección.",
    expected: "θ = f(Bi, Fo)",
    dependent: 0,
    variables: [
      { kind: "dimensionless", symbol: "θ", name: "Temperatura adimensional (T−T∞)/(T₀−T∞)", value: 0.5 },
      { kind: "heat_transfer_coeff", value: 50 },
      { kind: "thickness", name: "Semiespesor", value: 10 },
      { kind: "solid_thermal_conductivity", value: 15 },
      { kind: "thermal_diffusivity", name: "Difusividad térmica del sólido", value: 4e-6 },
      { kind: "time", value: 60 },
    ],
    preferred: ["Bi", "Fo"],
    tip: "Si Bi < 0.1 la temperatura es casi uniforme y se usa el modelo de capacitancia concentrada.",
  },

  // ───────────────────────── Transferencia de masa y reacción
  {
    id: "convective-mass",
    name: "Transferencia de masa convectiva",
    area: "Transferencia de masa y reacción",
    icon: "💧",
    description: "Coeficiente de transferencia de masa entre una superficie y un fluido en movimiento.",
    expected: "Sh = f(Re, Sc)",
    dependent: 0,
    variables: [
      { kind: "mass_transfer_coeff", value: 2e-5 },
      { kind: "diameter", value: 0.01 },
      { kind: "velocity", value: 0.2 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "diffusivity", value: 1e-9 },
    ],
    preferred: ["Sh", "Re", "Sc"],
    tip: "Frössling (esfera): Sh = 2 + 0.6·Re^½·Sc^⅓. Analogía de Chilton–Colburn con la transferencia de calor.",
  },
  {
    id: "bubble-column-kla",
    name: "Columna de burbujeo (kLa)",
    area: "Transferencia de masa y reacción",
    icon: "🧪",
    description: "Transferencia de oxígeno en una columna de burbujeo sin agitación mecánica (air-lift).",
    expected: "Sh_v = f(Re, Fr, We, Sc)",
    dependent: 0,
    variables: [
      { kind: "kla", value: 30 },
      { kind: "superficial_gas_velocity", value: 0.02 },
      { kind: "tank_diameter", name: "Diámetro de la columna", value: 0.15 },
      { kind: "density", value: 1000 },
      { kind: "dynamic_viscosity", value: 0.001 },
      { kind: "surface_tension", value: 0.072 },
      { kind: "diffusivity", value: 2.1e-9 },
      { kind: "gravity", value: 9.81 },
    ],
    preferred: ["Sh_v"],
    tip: "Akita–Yoshida expresan Sh_v en función de Sc, Bo, Ga y Fr: otra base equivalente de los mismos grupos.",
  },
  {
    id: "tubular-reactor",
    name: "Reactor tubular con dispersión",
    area: "Transferencia de masa y reacción",
    icon: "🧬",
    description: "Conversión en un reactor tubular con reacción de primer orden y dispersión axial.",
    expected: "X = f(Da, Pe_m)",
    dependent: 0,
    variables: [
      { kind: "dimensionless", symbol: "X", name: "Conversión", value: 0.6 },
      { kind: "reaction_rate_constant", value: 0.01 },
      { kind: "char_length", name: "Longitud del reactor", value: 2 },
      { kind: "velocity", value: 0.05 },
      { kind: "diffusivity", symbol: "D_ax", name: "Coeficiente de dispersión axial", value: 1e-4 },
    ],
    preferred: ["Da", "PeM"],
    tip: "Pe → ∞ corresponde a flujo pistón y Pe → 0 a mezcla perfecta.",
  },

  // ───────────────────────── Didácticos
  {
    id: "pendulum",
    name: "Péndulo simple",
    area: "Ejemplos didácticos",
    icon: "🕰️",
    description: "Ejemplo clásico: ¿de qué depende el periodo de un péndulo?",
    expected: "t²g/L = f(θ₀)",
    dependent: 0,
    variables: [
      { kind: "time", symbol: "t", name: "Periodo", value: 2.0 },
      { kind: "char_length", name: "Longitud del hilo", value: 1 },
      { kind: "mass", value: 0.5 },
      { kind: "gravity", value: 9.81 },
      { kind: "dimensionless", symbol: "θ₀", name: "Amplitud angular", unit: "rad", value: 0.1 },
    ],
    tip: "El análisis detecta que la masa no puede influir (es la única variable con dimensión de masa).",
  },
];

export const TEMPLATE_BY_ID: Record<string, ProcessTemplate> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/** Ejemplos de «¿qué pasa si…?» para entender por qué se agregan o quitan variables. */
export const WHAT_IF: Record<string, string[]> = {
  "agitated-power": [
    "Quita g: desaparece Fr. Es válido en tanques con deflectores, donde no se forma vórtice.",
    "Quita μ: Po deja de depender de Re. Es lo que ocurre en régimen turbulento (Po ≈ constante).",
    "Agrega la altura de líquido H_L: aparece la relación H_L/D como un grupo más.",
  ],
  "aerated-power": [
    "Quita Q_g: vuelves al tanque sin aireación y desaparece Fl.",
    "Agrega σ: aparece We, importante para el tamaño de las burbujas.",
  ],
  "bioreactor-kla": [
    "Quita σ: desaparece We. Equivale a suponer que el tamaño de burbuja no cambia.",
    "Agrega el diámetro del tanque D_t: aparece D_t/D (forma del equipo).",
    "Agrega la potencia P_g: aparece Po y puedes relacionar kLa con P/V como en van't Riet.",
  ],
  "mixing-time": ["Quita μ: en régimen turbulento N·θₘ resulta constante para la geometría."],
  "pipe-flow": [
    "Quita ε (tubo liso): desaparece ε/D y Eu sólo depende de Re y L/D.",
    "Quita μ (turbulencia completa): la fricción ya no depende de Re, sólo de ε/D.",
  ],
  "centrifugal-pump": ["Agrega la potencia P: aparece el coeficiente de potencia Po (leyes de afinidad)."],
  "sphere-drag": ["Agrega g y Δρ: aparece Ar y puedes estudiar la sedimentación."],
  "forced-convection": [
    "Agrega la longitud L del tubo: aparece L/D (efecto de entrada).",
    "Agrega la viscosidad en la pared μ_w (otra viscosidad): aparece μ/μ_w (corrección de Sieder–Tate).",
  ],
  "natural-convection": ["Observa los valores de βΔT y Di: son mucho menores que 1, por eso en la práctica se usa Nu = f(Gr, Pr)."],
  "convective-mass": ["Agrega la conductividad y c_p: aparecen Pr y Le (analogía calor–masa)."],
  pendulum: ["Quita la masa m: el aviso desaparece y el resultado no cambia, porque la masa no influye."],
};

/**
 * Configuración inicial del escalamiento por plantilla.
 * criteria: ids de números de la biblioteca, símbolos de relaciones o "preset:<id>".
 * rules: reglas por tipo de magnitud que cambian la regla por omisión.
 */
export interface ScaleDefaults {
  lambda?: number;
  criteria: string[];
  rules?: Record<string, "igual" | "geometria" | "fijo" | "calcular">;
  note?: string;
}

export const SCALE_DEFAULTS: Record<string, ScaleDefaults> = {
  "agitated-power": {
    criteria: ["Po", "preset:PV"],
    note: "Escalamiento clásico: régimen turbulento (Po constante) y misma potencia por volumen.",
  },
  "aerated-power": {
    criteria: ["Po", "Fl", "preset:PV"],
    note: "P/V constante, misma potencia relativa (Po con aireación) y mismo número de aireación Fl.",
  },
  "bioreactor-kla": {
    criteria: ["kLa_N", "preset:tip", "preset:vvm"],
    note: "Velocidad de punta constante (cuidar las células) y misma aireación en vvm: observa qué pasa con kLa.",
  },
  "mixing-time": {
    criteria: ["N_theta", "preset:tip"],
    note: "Con velocidad de punta constante, N baja y el tiempo de mezclado crece con el tamaño.",
  },
  "centrifugal-pump": {
    lambda: 1.5,
    criteria: ["psi", "Fl"],
    rules: { rotational_speed: "igual" },
    note: "Leyes de afinidad: misma velocidad de giro con un rodete más grande.",
  },
  "sphere-drag": {
    lambda: 0.5,
    criteria: ["Cd", "Re"],
    note: "Similitud completa: Re igual en modelo y prototipo.",
  },
  "forced-convection": {
    lambda: 2,
    criteria: ["Nu", "Re", "Pr"],
  },
  "bubble-column-kla": {
    lambda: 5,
    criteria: ["preset:vs", "preset:kla"],
    rules: {},
    note: "Escalamiento típico de columnas: misma velocidad superficial del gas.",
  },
};

export const WHAT_IF_GENERIC = [
  "Cada variable que agregas suele añadir un grupo adimensional; cada una que quitas es una suposición («no influye»).",
  "Si una variable no puede formar ningún grupo, probablemente falta otra variable con dimensiones que la compensen.",
];
