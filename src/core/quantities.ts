/**
 * Catálogo de magnitudes físicas ("tipos" de variable).
 *
 * Conocer el tipo de cada variable permite:
 *   - proponer símbolo y unidades por defecto,
 *   - elegir buenas variables repetidas,
 *   - reconocer números adimensionales con nombre (Re, Nu, Po, ...).
 *
 * `family` agrupa tipos intercambiables al formar números: por ejemplo, el
 * Reynolds de una tubería usa cualquier longitud característica (diámetro,
 * longitud, diámetro de partícula...).
 */
import { DimVector } from "./dimensions";
import { parseUnit } from "./units";

export type QuantityCategory =
  | "Geometría"
  | "Cinemática y flujo"
  | "Propiedades del fluido"
  | "Fuerzas, presión y energía"
  | "Calor"
  | "Masa y reacción"
  | "Otras";

export interface QuantityKind {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  category: QuantityCategory;
  family?: string;
  /** Prioridad como variable repetida (menor = mejor). */
  repeatPriority: number;
  /** Preferencia como longitud/velocidad característica dentro de su familia (menor = mejor). */
  charScore?: number;
  defaultValue?: number;
  keywords?: string;
  dims: DimVector;
}

type KindSpec = Omit<QuantityKind, "dims">;

const SPECS: KindSpec[] = [
  // Geometría
  { id: "char_length", name: "Longitud característica", symbol: "L", unit: "m", category: "Geometría", family: "length", repeatPriority: 1, charScore: 1 },
  { id: "diameter", name: "Diámetro", symbol: "D", unit: "m", category: "Geometría", family: "length", repeatPriority: 1, charScore: 1, keywords: "tubo tubería conducto" },
  { id: "impeller_diameter", name: "Diámetro del impulsor", symbol: "D", unit: "m", category: "Geometría", family: "length", repeatPriority: 1, charScore: 1, keywords: "agitador turbina rushton bomba rodete" },
  { id: "tank_diameter", name: "Diámetro del tanque", symbol: "D_t", unit: "m", category: "Geometría", family: "length", repeatPriority: 2, charScore: 3, keywords: "recipiente reactor biorreactor" },
  { id: "particle_diameter", name: "Diámetro de partícula / burbuja / gota", symbol: "d_p", unit: "mm", category: "Geometría", family: "length", repeatPriority: 1, charScore: 1, keywords: "esfera célula pellet" },
  { id: "pipe_length", name: "Longitud de tubería / equipo", symbol: "L", unit: "m", category: "Geometría", family: "length", repeatPriority: 2, charScore: 4 },
  { id: "liquid_height", name: "Altura de líquido", symbol: "H_L", unit: "m", category: "Geometría", family: "length", repeatPriority: 2, charScore: 4 },
  { id: "thickness", name: "Espesor", symbol: "δ", unit: "mm", category: "Geometría", family: "length", repeatPriority: 2, charScore: 2, keywords: "pared placa" },
  { id: "roughness", name: "Rugosidad", symbol: "ε", unit: "mm", category: "Geometría", family: "length", repeatPriority: 5, charScore: 9 },
  { id: "area", name: "Área", symbol: "A", unit: "m²", category: "Geometría", repeatPriority: 6 },
  { id: "volume", name: "Volumen", symbol: "V", unit: "L", category: "Geometría", repeatPriority: 6, keywords: "volumen de trabajo líquido" },

  // Cinemática y flujo
  { id: "velocity", name: "Velocidad", symbol: "v", unit: "m/s", category: "Cinemática y flujo", family: "velocity", repeatPriority: 2, charScore: 1 },
  { id: "terminal_velocity", name: "Velocidad terminal / de ascenso", symbol: "v_t", unit: "m/s", category: "Cinemática y flujo", family: "velocity", repeatPriority: 3, charScore: 2, keywords: "sedimentación burbuja" },
  { id: "superficial_gas_velocity", name: "Velocidad superficial del gas", symbol: "v_s", unit: "m/s", category: "Cinemática y flujo", family: "velocity", repeatPriority: 3, charScore: 3, keywords: "aireación columna burbujeo" },
  { id: "rotational_speed", name: "Velocidad de agitación / rotación", symbol: "N", unit: "rpm", category: "Cinemática y flujo", family: "freq", repeatPriority: 2, keywords: "rpm agitador bomba" },
  { id: "frequency", name: "Frecuencia", symbol: "f", unit: "Hz", category: "Cinemática y flujo", family: "freq", repeatPriority: 3 },
  { id: "gravity", name: "Aceleración de la gravedad", symbol: "g", unit: "m/s²", category: "Cinemática y flujo", repeatPriority: 6, defaultValue: 9.81 },
  { id: "volumetric_flow", name: "Caudal volumétrico", symbol: "Q", unit: "m³/h", category: "Cinemática y flujo", family: "flow", repeatPriority: 5, keywords: "flujo gasto" },
  { id: "gas_flow", name: "Flujo de gas (aireación)", symbol: "Q_g", unit: "L/min", category: "Cinemática y flujo", family: "flow", repeatPriority: 6, keywords: "aire vvm aireación" },
  { id: "mass_flow", name: "Flujo másico", symbol: "ṁ", unit: "kg/s", category: "Cinemática y flujo", repeatPriority: 6 },
  { id: "time", name: "Tiempo", symbol: "t", unit: "s", category: "Cinemática y flujo", family: "time", repeatPriority: 7, charScore: 1 },
  { id: "mixing_time", name: "Tiempo de mezclado", symbol: "θ_m", unit: "s", category: "Cinemática y flujo", family: "time", repeatPriority: 8, charScore: 2 },
  { id: "residence_time", name: "Tiempo de residencia", symbol: "τ", unit: "min", category: "Cinemática y flujo", family: "time", repeatPriority: 8, charScore: 2 },

  // Propiedades del fluido
  { id: "density", name: "Densidad", symbol: "ρ", unit: "kg/m³", category: "Propiedades del fluido", family: "density", repeatPriority: 3 },
  { id: "density_difference", name: "Diferencia de densidades", symbol: "Δρ", unit: "kg/m³", category: "Propiedades del fluido", repeatPriority: 5 },
  { id: "dynamic_viscosity", name: "Viscosidad dinámica", symbol: "μ", unit: "Pa·s", category: "Propiedades del fluido", repeatPriority: 4, keywords: "cP centipoise" },
  { id: "kinematic_viscosity", name: "Viscosidad cinemática", symbol: "ν", unit: "m²/s", category: "Propiedades del fluido", repeatPriority: 4 },
  { id: "surface_tension", name: "Tensión superficial", symbol: "σ", unit: "N/m", category: "Propiedades del fluido", repeatPriority: 5 },
  { id: "thermal_conductivity", name: "Conductividad térmica (fluido)", symbol: "k", unit: "W/(m·K)", category: "Propiedades del fluido", repeatPriority: 5 },
  { id: "solid_thermal_conductivity", name: "Conductividad térmica (sólido)", symbol: "k_s", unit: "W/(m·K)", category: "Propiedades del fluido", repeatPriority: 6 },
  { id: "specific_heat", name: "Capacidad calorífica", symbol: "c_p", unit: "J/(kg·K)", category: "Propiedades del fluido", repeatPriority: 5 },
  { id: "thermal_diffusivity", name: "Difusividad térmica", symbol: "α", unit: "m²/s", category: "Propiedades del fluido", repeatPriority: 5 },
  { id: "thermal_expansion", name: "Coeficiente de expansión térmica", symbol: "β", unit: "1/K", category: "Propiedades del fluido", repeatPriority: 6 },
  { id: "diffusivity", name: "Difusividad molecular", symbol: "D_AB", unit: "m²/s", category: "Propiedades del fluido", repeatPriority: 5, keywords: "difusión oxígeno" },

  // Fuerzas, presión y energía
  { id: "pressure_drop", name: "Caída / aumento de presión", symbol: "ΔP", unit: "Pa", category: "Fuerzas, presión y energía", family: "pressure", repeatPriority: 6, charScore: 1 },
  { id: "pressure", name: "Presión", symbol: "p", unit: "Pa", category: "Fuerzas, presión y energía", family: "pressure", repeatPriority: 6, charScore: 2 },
  { id: "force", name: "Fuerza", symbol: "F", unit: "N", category: "Fuerzas, presión y energía", family: "force", repeatPriority: 6 },
  { id: "drag_force", name: "Fuerza de arrastre", symbol: "F_D", unit: "N", category: "Fuerzas, presión y energía", family: "force", repeatPriority: 7 },
  { id: "power", name: "Potencia", symbol: "P", unit: "W", category: "Fuerzas, presión y energía", repeatPriority: 7, keywords: "consumo agitación" },
  { id: "head", name: "Carga (altura de bombeo)", symbol: "H", unit: "m", category: "Fuerzas, presión y energía", repeatPriority: 7 },
  { id: "mass", name: "Masa", symbol: "m", unit: "kg", category: "Fuerzas, presión y energía", repeatPriority: 4 },

  // Calor
  { id: "heat_transfer_coeff", name: "Coeficiente de transferencia de calor", symbol: "h", unit: "W/(m²·K)", category: "Calor", repeatPriority: 7, keywords: "convección película" },
  { id: "temperature_difference", name: "Diferencia de temperatura", symbol: "ΔT", unit: "K", category: "Calor", repeatPriority: 5 },
  { id: "temperature", name: "Temperatura", symbol: "T", unit: "K", category: "Calor", repeatPriority: 5 },
  { id: "heat_flux", name: "Flux de calor", symbol: "q", unit: "W/m²", category: "Calor", repeatPriority: 7 },

  // Masa y reacción
  { id: "mass_transfer_coeff", name: "Coeficiente de transferencia de masa", symbol: "k_L", unit: "m/s", category: "Masa y reacción", repeatPriority: 7 },
  { id: "kla", name: "Coef. volumétrico de transferencia de masa", symbol: "k_La", unit: "1/h", category: "Masa y reacción", repeatPriority: 8, keywords: "kla oxígeno aireación biorreactor" },
  { id: "concentration", name: "Concentración", symbol: "C", unit: "mol/m³", category: "Masa y reacción", repeatPriority: 6, keywords: "oxígeno disuelto sustrato" },
  { id: "reaction_rate_constant", name: "Constante de velocidad (1er orden)", symbol: "k_r", unit: "1/s", category: "Masa y reacción", repeatPriority: 7 },
  { id: "growth_rate", name: "Velocidad específica de crecimiento", symbol: "μ_x", unit: "1/h", category: "Masa y reacción", repeatPriority: 8, keywords: "monod biomasa células" },
  { id: "dimensionless", name: "Variable adimensional", symbol: "X", unit: "1", category: "Otras", repeatPriority: 99, keywords: "conversión ángulo fracción rendimiento" },
];

export const QUANTITY_KINDS: QuantityKind[] = SPECS.map((s) => ({ ...s, dims: parseUnit(s.unit).dims }));

export const KIND_BY_ID: Record<string, QuantityKind> = Object.fromEntries(QUANTITY_KINDS.map((k) => [k.id, k]));

export const QUANTITY_CATEGORIES: QuantityCategory[] = [
  "Geometría",
  "Cinemática y flujo",
  "Propiedades del fluido",
  "Fuerzas, presión y energía",
  "Calor",
  "Masa y reacción",
  "Otras",
];

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function searchKinds(query: string): QuantityKind[] {
  const q = normalize(query.trim());
  if (!q) return QUANTITY_KINDS;
  return QUANTITY_KINDS.filter((k) =>
    normalize(`${k.name} ${k.symbol} ${k.unit} ${k.keywords ?? ""}`).includes(q),
  );
}
