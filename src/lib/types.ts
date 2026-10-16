export type Category = 'top' | 'tercera' | 'inferior' | 'vestido' | 'calzado' | 'accesorio';

export const CATEGORY_LABEL: Record<Category, string> = {
  top: 'Blusa/Top',
  tercera: 'Tercera pieza',
  inferior: 'Pantalón sastre/Falda',
  vestido: 'Vestido',
  calzado: 'Calzado',
  accesorio: 'Bolso/Accesorio',
};

export const CATEGORY_ORDER: Category[] = ['tercera', 'top', 'inferior', 'vestido', 'calzado', 'accesorio'];

/** Estilo del outfit de un día. Cada uno fija formalidad objetivo y si exige tercera pieza. */
export type OutfitStyle = 'ejecutivo' | 'casual' | 'elegante' | 'deportivo' | 'playa' | 'fiesta';

export interface OutfitStyleMeta {
  label: string;
  /** Formalidad objetivo (1-5). */
  formality: number;
  /** Formalidad mínima de cada prenda principal. */
  minFormality: number;
  /** Tercera pieza obligatoria si existe alguna en el clóset. */
  requiresThird: boolean;
  /** Ignora el clima de Bogotá (p. ej. playa). */
  ignoreWeather: boolean;
  hint: string;
}

export const OUTFIT_STYLES: Record<OutfitStyle, OutfitStyleMeta> = {
  ejecutivo: { label: 'Ejecutivo', formality: 4, minFormality: 2, requiresThird: true, ignoreWeather: false, hint: 'Oficina, reuniones, audiencias' },
  casual: { label: 'Casual', formality: 2.5, minFormality: 1, requiresThird: false, ignoreWeather: false, hint: 'Día relajado, diligencias' },
  elegante: { label: 'Elegante', formality: 4.5, minFormality: 3, requiresThird: false, ignoreWeather: false, hint: 'Cena, evento especial' },
  deportivo: { label: 'Deportivo', formality: 1.5, minFormality: 1, requiresThird: false, ignoreWeather: false, hint: 'Gimnasio, caminata, athleisure' },
  playa: { label: 'Playa', formality: 1.5, minFormality: 1, requiresThird: false, ignoreWeather: true, hint: 'Clima cálido, vacaciones' },
  fiesta: { label: 'Fiesta', formality: 4, minFormality: 2, requiresThird: false, ignoreWeather: false, hint: 'Noche, celebración' },
};

export const OUTFIT_STYLE_ORDER: OutfitStyle[] = ['ejecutivo', 'casual', 'elegante', 'deportivo', 'playa', 'fiesta'];

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
  /** Estilos para los que sirve la prenda (etiquetado por Gemini o manual). */
  styles?: OutfitStyle[];
  /** Gemini detectó varias prendas en la foto. */
  multipleInPhoto?: boolean;
  /** Carga masiva: la IA no pudo etiquetarla y conviene revisarla a mano. */
  needsReview?: boolean;
}

/** Un look: blusa + inferior, o un vestido; tercera pieza opcional según el estilo; calzado obligatorio. */
export interface Look {
  topId?: string;
  bottomId?: string;
  dressId?: string;
  thirdId?: string;
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
  /** Estilo del día (si no hay, se usa el de la semana). */
  style?: OutfitStyle;
  /** La usuaria pidió permitir repetir una combinación ya usada. */
  allowRepeat?: boolean;
  /** Imagen generada de la usuaria vistiendo el look. */
  tryOnUri?: string;
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
  /** Modelo de Gemini para generar la imagen del look puesto. */
  imageModel: string;
  useGeminiPlanner: boolean;
  weekOffset: 0 | 1;
  /** null = aún no se le ha preguntado a la usuaria. */
  styleMode: 'same' | 'perDay' | null;
  weekStyle: OutfitStyle;
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'gemini-3.5-flash',
  imageModel: 'gemini-3.1-flash-image',
  useGeminiPlanner: true,
  weekOffset: 0,
  styleMode: null,
  weekStyle: 'ejecutivo',
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
  /** Foto de cuerpo entero (opcional) para el probador virtual. Solo en el teléfono. */
  bodyPhotoUri?: string;
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
