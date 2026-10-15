import type { Category, DayWeather, Garment, Look } from './types';
import { CATEGORY_LABEL } from './types';

/**
 * Motor de reglas del planificador. Es la fuente de verdad: cualquier look
 * (generado localmente o propuesto por Gemini) se valida aquí antes de aceptarse.
 *
 * Reglas estrictas:
 *  1. Todo look lleva capas: Blusa/Top + Tercera pieza + Pantalón/Falda + Calzado (+ Bolso/Accesorio opcional).
 *  2. Prendas principales (top, tercera pieza, pantalón/falda) nunca se repiten en la misma semana.
 *  3. La lista de exclusión (prendas de los otros días) es obligatoria. Solo el calzado puede
 *     repetirse, y únicamente si no existe ninguna alternativa (se advierte en la tarjeta).
 *     El bolso/accesorio es opcional: si no queda uno libre se omite, nunca se repite.
 *  4. Ningún look completo (top + tercera pieza + inferior + calzado) puede coincidir con el Historial.
 *  5. Formalidad ejecutiva mínima y abrigo suficiente para el frío de Bogotá.
 */

export interface PlanContext {
  items: Garment[];
  weather: DayWeather;
  /** Prendas usadas en los otros días de la semana: exclusión obligatoria. */
  exclude: Set<string>;
  historySignatures: Set<string>;
  /** Firmas adicionales a evitar (p. ej. el look actual del día que se regenera). */
  avoidSignatures: Set<string>;
  note: string;
}

export type PlanResult =
  | { ok: true; look: Look; warnings: string[] }
  | { ok: false; error: string };

export function lookSignature(look: Pick<Look, 'topId' | 'thirdId' | 'bottomId' | 'shoesId'>): string {
  return [look.topId, look.thirdId, look.bottomId, look.shoesId].sort().join('|');
}

export function lookItemIds(look: Look | null | undefined): string[] {
  if (!look) return [];
  const ids = [look.topId, look.thirdId, look.bottomId, look.shoesId];
  if (look.accessoryId) ids.push(look.accessoryId);
  return ids;
}

const NEUTRALS = [
  'negro', 'blanco', 'marfil', 'crema', 'beige', 'camel', 'gris', 'marino', 'navy', 'taupe', 'arena', 'hueso',
  'café', 'cafe', 'chocolate', 'nude', 'topo', 'carbón', 'carbon', 'plata', 'dorado', 'ivory', 'black', 'white',
  'grey', 'gray', 'brown', 'tan', 'perla', 'piedra', 'visón', 'vison', 'tostado', 'kaki', 'caqui', 'oliva',
];

const COLOR_WORDS = [
  'negro', 'blanco', 'marfil', 'crema', 'beige', 'camel', 'gris', 'azul', 'marino', 'taupe', 'café', 'chocolate',
  'vino', 'burdeos', 'rojo', 'verde', 'oliva', 'rosa', 'nude', 'mostaza', 'amarillo', 'morado', 'lila', 'naranja',
  'terracota', 'plata', 'dorado', 'celeste', 'esmeralda', 'perla', 'hueso',
];

export function isNeutral(color: string): boolean {
  const c = color.toLowerCase();
  return NEUTRALS.some((n) => c.includes(n));
}

export interface NoteIntent {
  formalityBias: number;
  warm: boolean;
  rain: boolean;
  colors: string[];
  wantSkirt: boolean;
  wantPants: boolean;
}

export function parseNote(note: string): NoteIntent {
  const n = note
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const has = (...words: string[]) => words.some((w) => n.includes(w));
  let formalityBias = 0;
  if (has('elegan', 'formal', 'junta', 'reunion', 'audiencia', 'presentacion', 'cliente', 'comite', 'gala', 'impecable', 'sobrio')) formalityBias += 1;
  if (has('casual', 'relajad', 'comod', 'informal', 'sencill')) formalityBias -= 1;
  const colors = COLOR_WORDS.filter((c) =>
    n.includes(
      c
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, ''),
    ),
  );
  return {
    formalityBias,
    warm: has('frio', 'abrig', 'helad', 'calid'),
    rain: has('lluvi', 'llov', 'aguacero', 'impermeable'),
    colors,
    wantSkirt: has('falda'),
    wantPants: has('pantalon'),
  };
}

/** Abrigo térmico requerido según la temperatura mínima del día (trayecto de la mañana en Bogotá). */
export function warmthNeed(w: DayWeather, intent?: NoteIntent): number {
  let need = w.min <= 8 ? 8 : w.min <= 10 ? 7 : w.min <= 12 ? 6.5 : 6;
  if (w.max >= 21) need -= 0.5;
  if (intent?.warm) need += 1;
  return need;
}

function warmthOf(top: Garment, third: Garment, bottom: Garment): number {
  return top.warmth + third.warmth + bottom.warmth * 0.5;
}

function byId(items: Garment[]): Map<string, Garment> {
  return new Map(items.map((i) => [i.id, i]));
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function isRainy(w: DayWeather, intent: NoteIntent): boolean {
  return w.rainProb >= 50 || intent.rain;
}

/** Valida un look contra todas las reglas. Devuelve la lista de violaciones (vacía = válido). */
export function validateLook(look: Look, ctx: PlanContext, allowShoeRepeat: boolean): string[] {
  const map = byId(ctx.items);
  const errors: string[] = [];
  const slots: [keyof Look, Category][] = [
    ['topId', 'top'],
    ['thirdId', 'tercera'],
    ['bottomId', 'inferior'],
    ['shoesId', 'calzado'],
  ];
  for (const [key, cat] of slots) {
    const g = map.get(look[key] as string);
    if (!g) errors.push(`Falta ${CATEGORY_LABEL[cat]} o el id no existe.`);
    else if (g.category !== cat) errors.push(`"${g.name}" no es ${CATEGORY_LABEL[cat]}.`);
  }
  if (look.accessoryId) {
    const a = map.get(look.accessoryId);
    if (!a || a.category !== 'accesorio') errors.push('El accesorio indicado no es válido.');
  }
  if (errors.length) return errors;

  const top = map.get(look.topId)!;
  const third = map.get(look.thirdId)!;
  const bottom = map.get(look.bottomId)!;
  const shoes = map.get(look.shoesId)!;

  for (const g of [top, third, bottom]) {
    if (ctx.exclude.has(g.id)) errors.push(`"${g.name}" ya se usa otro día de la semana (prenda principal).`);
  }
  if (!allowShoeRepeat && ctx.exclude.has(shoes.id)) errors.push(`"${shoes.name}" ya se usa otro día de la semana.`);
  if (look.accessoryId && ctx.exclude.has(look.accessoryId)) errors.push('El accesorio ya se usa otro día de la semana.');
  const sig = lookSignature(look);
  if (ctx.historySignatures.has(sig)) errors.push('Ese look completo ya está en el Historial.');
  if (ctx.avoidSignatures.has(sig)) errors.push('Es el mismo look que ya tenía el día.');

  const core = [top, third, bottom, shoes];
  if (core.some((g) => g.formality < 2)) errors.push('Incluye una prenda con formalidad 1 (no ejecutiva).');
  if (avg(core.map((g) => g.formality)) < 3) errors.push('Formalidad ejecutiva promedio inferior a 3.');

  const intent = parseNote(ctx.note);
  if (warmthOf(top, third, bottom) < warmthNeed(ctx.weather, intent) - 2) {
    errors.push('Abrigo insuficiente para el frío de Bogotá.');
  }
  return errors;
}

function scoreLook(
  top: Garment,
  third: Garment,
  bottom: Garment,
  shoes: Garment,
  ctx: PlanContext,
  intent: NoteIntent,
  rand: () => number,
): number {
  let s = 0;
  const core = [top, third, bottom, shoes];
  const f = avg(core.map((g) => g.formality));
  const target = Math.max(3, Math.min(5, 4 + intent.formalityBias));
  s -= Math.abs(f - target) * 3;
  if (intent.formalityBias > 0) s += f;

  const diff = warmthOf(top, third, bottom) - warmthNeed(ctx.weather, intent);
  s += diff < 0 ? diff * 4 : -Math.max(0, diff - 2.5) * 1.5;

  if (isRainy(ctx.weather, intent)) {
    s += shoes.rainSafe ? 4 : -6;
    if (third.rainSafe) s += 2;
  }
  // Oficina cerrada: al quitarse la tercera pieza, la blusa debe sostener el look sola.
  s += top.formality >= 3 ? 2 : -2;

  const statement = core.filter((g) => !isNeutral(g.color)).length;
  s += statement === 0 ? 1 : statement === 1 ? 3 : statement === 2 ? 0 : -4;
  if (!isNeutral(top.color) && top.color.toLowerCase() === bottom.color.toLowerCase()) s -= 2;

  if (intent.colors.length) {
    const hit = core.some((g) => intent.colors.some((c) => g.color.toLowerCase().includes(c)));
    s += hit ? 4 : 0;
  }
  const isSkirt = /falda/i.test(`${bottom.subtype} ${bottom.name}`);
  if (intent.wantSkirt) s += isSkirt ? 5 : -2;
  if (intent.wantPants) s += !isSkirt ? 5 : -2;

  if (ctx.exclude.has(shoes.id)) s -= 8;
  return s + rand() * 2.5;
}

function pickAccessory(
  items: Garment[],
  ctx: PlanContext,
  targetFormality: number,
  rand: () => number,
): Garment | undefined {
  const pool = items.filter((i) => i.category === 'accesorio' && !ctx.exclude.has(i.id));
  let best: Garment | undefined;
  let bestScore = -Infinity;
  for (const a of pool) {
    let sc = -Math.abs(a.formality - targetFormality) + rand();
    if (isRainy(ctx.weather, parseNote(ctx.note)) && a.rainSafe) sc += 1;
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  return best;
}

export function describeLook(look: Look, items: Garment[], w: DayWeather): string {
  const map = byId(items);
  const t = map.get(look.thirdId);
  const top = map.get(look.topId);
  const b = map.get(look.bottomId);
  const sh = map.get(look.shoesId);
  if (!t || !top || !b || !sh) return '';
  const f = avg([t, top, b, sh].map((g) => g.formality)).toFixed(1).replace('.', ',');
  const rain = w.rainProb >= 50 ? (sh.rainSafe ? ` · calzado apto para lluvia (${w.rainProb} %)` : ` · lleva paraguas (${w.rainProb} %)`) : '';
  return `Capas para ${w.min}–${w.max} °C: ${t.subtype || t.name} sobre ${top.subtype || top.name}; en oficina cerrada la blusa se sostiene sola. Formalidad ${f}/5${rain}.`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function missingReport(ctx: PlanContext): string {
  const free = (cat: Category, allowRepeat = false) =>
    ctx.items.filter((i) => i.category === cat && (allowRepeat || !ctx.exclude.has(i.id))).length;
  const parts: string[] = [];
  if (free('top') === 0) parts.push('Blusa/Top');
  if (free('tercera') === 0) parts.push('Tercera pieza (blazer/abrigo)');
  if (free('inferior') === 0) parts.push('Pantalón sastre/Falda');
  if (free('calzado', true) === 0) parts.push('Calzado');
  if (parts.length) return `No hay prendas libres en: ${parts.join(', ')}. Agrega más prendas a tu clóset o desbloquea otro día.`;
  return 'Todas las combinaciones posibles ya están en el Historial, se usan otro día o no cumplen formalidad/abrigo. Agrega prendas o depura el Historial.';
}

/** Arma el mejor look para un día respetando todas las reglas. */
export function planDay(ctx: PlanContext, seed: number = Date.now()): PlanResult {
  const rand = mulberry32(seed);
  const intent = parseNote(ctx.note);
  const cat = (c: Category) => ctx.items.filter((i) => i.category === c);
  const tops = cat('top').filter((i) => !ctx.exclude.has(i.id));
  const thirds = cat('tercera').filter((i) => !ctx.exclude.has(i.id));
  const bottoms = cat('inferior').filter((i) => !ctx.exclude.has(i.id));
  const allShoes = cat('calzado');

  for (const allowRepeat of [false, true]) {
    // El segundo intento solo tiene sentido si hay calzado excluido que pueda reutilizarse.
    if (allowRepeat && !allShoes.some((s) => ctx.exclude.has(s.id))) continue;
    const shoes = allowRepeat ? allShoes : allShoes.filter((i) => !ctx.exclude.has(i.id));
    const rainy = isRainy(ctx.weather, intent);

    let best: { top: Garment; third: Garment; bottom: Garment; shoes: Garment; score: number } | null = null;
    for (const top of tops) {
      for (const third of thirds) {
        for (const bottom of bottoms) {
          for (const sh of shoes) {
            const candidate: Look = {
              topId: top.id,
              thirdId: third.id,
              bottomId: bottom.id,
              shoesId: sh.id,
              rationale: '',
            };
            if (validateLook(candidate, ctx, allowRepeat).length) continue;
            const score = scoreLook(top, third, bottom, sh, ctx, intent, rand);
            if (!best || score > best.score) best = { top, third, bottom, shoes: sh, score };
          }
        }
      }
    }
    if (!best) continue;

    const target = Math.max(3, Math.min(5, 4 + intent.formalityBias));
    // El accesorio es opcional: si no queda uno libre, se omite en lugar de repetirlo.
    const acc = pickAccessory(ctx.items, ctx, target, rand);
    const look: Look = {
      topId: best.top.id,
      thirdId: best.third.id,
      bottomId: best.bottom.id,
      shoesId: best.shoes.id,
      accessoryId: acc?.id,
      rationale: '',
    };
    look.rationale = describeLook(look, ctx.items, ctx.weather);
    const warnings: string[] = [];
    if (ctx.exclude.has(best.shoes.id)) warnings.push(`Calzado repetido en la semana: no hay otra alternativa libre ("${best.shoes.name}").`);
    if (rainy && !best.shoes.rainSafe) warnings.push('Día lluvioso y no tienes calzado apto para lluvia disponible.');
    return { ok: true, look, warnings };
  }
  return { ok: false, error: missingReport(ctx) };
}
