export type Category = 'top' | 'tercera' | 'inferior' | 'calzado' | 'accesorio';

export const CATEGORY_LABEL: Record<Category, string> = {
  top: 'Blusa/Top',
  tercera: 'Tercera pieza',
  inferior: 'Pantalón sastre/Falda',
  calzado: 'Calzado',
  accesorio: 'Bolso/Accesorio',
};

export const CATEGORY_ORDER: Category[] = ['tercera', 'top', 'inferior', 'calzado', 'accesorio'];

/** Prendas principales: no se pueden repetir dentro de la misma semana bajo ninguna circunstancia. */
export const MAIN_CATEGORIES: Category[] = ['top', 'tercera', 'inferior'];

export type Level = 1 | 2 | 3 | 4 | 5;

export interface Garment {
  id: string;
  imageUri: string;
  createdAt: string;
  category: Category;
  subtype: string;
  name: string;
  color: string;
  colorHex: string;
  texture: string;
  warmth: Level;
  formality: Level;
  rainSafe: boolean;
  aiTagged: boolean;
  /** Carga masiva: la IA no pudo etiquetarla y conviene revisarla a mano. */
  needsReview?: boolean;
}

export interface Look {
  topId: string;
  thirdId: string;
  bottomId: string;
  shoesId: string;
  accessoryId?: string;
  rationale: string;
}

export interface DayWeather {
  date: string;
  min: number;
  max: number;
  rainProb: number;
  estimated: boolean;
}

export interface DayPlan {
  dayIndex: number;
  date: string;
  look: Look | null;
  locked: boolean;
  note: string;
  source?: 'gemini' | 'local';
  error?: string;
  warnings?: string[];
}

export interface WeekPlan {
  weekStart: string;
  days: DayPlan[];
  generatedAt?: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  look: Look;
  signature: string;
  savedAt: string;
}

export interface Settings {
  model: string;
  useGeminiPlanner: boolean;
  weekOffset: 0 | 1;
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'gemini-4-argon',
  useGeminiPlanner: true,
  weekOffset: 0,
};

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export const STYLE_OPTIONS = ['Clásico ejecutivo', 'Minimalista', 'Elegante femenino', 'Moderno', 'Creativo', 'Relajado'] as const;

export const BODY_TYPES = [
  { key: 'reloj', label: 'Reloj de arena', hint: 'Hombros y cadera equilibrados, cintura marcada' },
  { key: 'pera', label: 'Pera / triángulo', hint: 'Cadera más ancha que los hombros' },
  { key: 'invertido', label: 'Triángulo invertido', hint: 'Hombros más anchos que la cadera' },
  { key: 'rectangulo', label: 'Rectángulo', hint: 'Hombros, cintura y cadera similares' },
  { key: 'manzana', label: 'Manzana / óvalo', hint: 'Volumen en el torso, piernas estilizadas' },
] as const;
export type BodyType = (typeof BODY_TYPES)[number]['key'];

/** Colorimetría estacional. */
export const SKIN_SEASONS = [
  { key: 'primavera', label: 'Primavera', hint: 'Cálida y luminosa' },
  { key: 'verano', label: 'Verano', hint: 'Fría y suave' },
  { key: 'otono', label: 'Otoño', hint: 'Cálida y profunda' },
  { key: 'invierno', label: 'Invierno', hint: 'Fría y contrastada' },
] as const;
export type SkinSeason = (typeof SKIN_SEASONS)[number]['key'];

export const UNDERTONES = [
  { key: 'calido', label: 'Cálido' },
  { key: 'frio', label: 'Frío' },
  { key: 'neutro', label: 'Neutro' },
] as const;
export type Undertone = (typeof UNDERTONES)[number]['key'];

export interface UserProfile {
  name: string;
  age: number | null;
  profession: string;
  style: string;
  heightCm: number | null;
  weightKg: number | null;
  bodyType: BodyType | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  skinSeason: SkinSeason | null;
  undertone: Undertone | null;
  completedAt?: string;
}

export const EMPTY_PROFILE: UserProfile = {
  name: '',
  age: null,
  profession: '',
  style: 'Clásico ejecutivo',
  heightCm: null,
  weightKg: null,
  bodyType: null,
  bustCm: null,
  waistCm: null,
  hipCm: null,
  skinSeason: null,
  undertone: null,
};
