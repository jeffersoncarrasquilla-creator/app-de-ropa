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
