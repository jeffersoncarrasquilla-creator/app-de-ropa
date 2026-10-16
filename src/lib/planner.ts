import type { Category, DayWeather, Garment, Look, OutfitStyle } from './types';
import { CATEGORY_LABEL, OUTFIT_STYLES } from './types';

/**
 * Motor de reglas del planificador.
 *
 * Reglas:
 *  1. Las prendas SÍ pueden repetirse en la semana (se favorece la variedad, sin prohibirla).
 *  2. Las COMBINACIONES completas no se repiten: ni dentro de la semana ni frente al Historial,
 *     salvo que la usuaria lo exija para ese día (`allowRepeat` o una nota tipo "repetir el look").
 *  3. Un look es blusa + inferior, o un vestido; calzado obligatorio; tercera pieza según el estilo
 *     (obligatoria en Ejecutivo) y el clima; bolso/accesorio opcional.
 *  4. El estilo del día (Ejecutivo, Casual, Elegante, Deportivo, Playa, Fiesta) fija la formalidad.
 *
 * La sugerencia de Gemini prevalece: `validateLook(look, ctx, 'ai')` solo rechaza violaciones duras
 * (ids inexistentes, estructura inválida o combinación prohibida). El motor local es el respaldo.
 */

export interface PlanContext {
  items: Garment[];
  weather: DayWeather;
  style: OutfitStyle;
  /** Combinaciones prohibidas (Historial + otros días de la semana + la actual al regenerar). */
  forbiddenSignatures: Set<string>;
  /** Prendas usadas otros días: no se prohíben, solo se penalizan para dar variedad. */
  usedElsewhere: Set<string>;
  note: string;
}

export type PlanResult = { ok: true; look: Look; warnings: string[] } | { ok: false; error: string };

export function lookSignature(look: Pick<Look, 'topId' | 'bottomId' | 'dressId' | 'thirdId' | 'shoesId'>): string {
  return [look.topId, look.bottomId, look.dressId, look.thirdId, look.shoesId].filter(Boolean).sort().join('|');
}

export function lookItemIds(look: Look | null | undefined): string[] {
  if (!look) return [];
  return [look.thirdId, look.dressId, look.topId, look.bottomId, look.shoesId, look.accessoryId].filter(
    (x): x is string => !!x,
  );
}

const NEUTRALS = [
  'negro', 'blanco', 'marfil', 'crema', 'beige', 'camel', 'gris', 'marino', 'navy', 'taupe', 'arena', 'hueso',
  'café', 'cafe', 'chocolate', 'nude', 'topo', 'carbón', 'carbon', 'plata', 'dorado', 'ivory', 'black', 'white',
  'grey', 'gray', 'brown', 'tan', 'perla', 'piedra', 'visón', 'vison', 'tostado', 'kaki', 'caqui', 'oliva', 'denim',
];

const COLOR_WORDS = [
  'negro', 'blanco', 'marfil', 'crema', 'beige', 'camel', 'gris', 'azul', 'marino', 'taupe', 'café', 'chocolate',
  'vino', 'burdeos', 'rojo', 'verde', 'oliva', 'rosa', 'nude', 'mostaza', 'amarillo', 'morado', 'lila', 'naranja',
  'terracota', 'plata', 'dorado', 'celeste', 'esmeralda', 'perla', 'hueso',
];

const strip = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
  wantDress: boolean;
  /** La usuaria pide expresamente repetir un look. */
  wantRepeat: boolean;
}

export function parseNote(note: string): NoteIntent {
  const n = strip(note);
  const has = (...words: string[]) => words.some((w) => n.includes(w));
  let formalityBias = 0;
  if (has('elegan', 'formal', 'junta', 'reunion', 'audiencia', 'presentacion', 'cliente', 'comite', 'gala', 'impecable', 'sobrio')) formalityBias += 1;
  if (has('casual', 'relajad', 'comod', 'informal', 'sencill')) formalityBias -= 1;
  return {
    formalityBias,
    warm: has('frio', 'abrig', 'helad', 'calid'),
    rain: has('lluvi', 'llov', 'aguacero', 'impermeable'),
    colors: COLOR_WORDS.filter((c) => n.includes(strip(c))),
    wantSkirt: has('falda'),
    wantPants: has('pantalon'),
    wantDress: has('vestido'),
    wantRepeat: has('repetir', 'repite', 'mismo look', 'mismo outfit', 'igual que'),
  };
}

/** Abrigo requerido según la temperatura mínima del día (trayecto de la mañana en Bogotá). */
export function warmthNeed(w: DayWeather, intent?: NoteIntent): number {
  let need = w.min <= 8 ? 8 : w.min <= 10 ? 7 : w.min <= 12 ? 6.5 : 6;
  if (w.max >= 21) need -= 0.5;
  if (intent?.warm) need += 1;
  return need;
}

/** Abrigo del look: torso (blusa o vestido) + tercera pieza + medio punto por el inferior. */
function warmthOf(base: Garment[], third?: Garment): number {
  const [a, b] = base;
  const torso = a.category === 'vestido' ? a.warmth + 1 : a.warmth + (b ? b.warmth * 0.5 : 0);
  return torso + (third?.warmth ?? 0);
}

function byId(items: Garment[]): Map<string, Garment> {
  return new Map(items.map((i) => [i.id, i]));
}

const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

function isRainy(w: DayWeather, intent: NoteIntent): boolean {
  return w.rainProb >= 50 || intent.rain;
}

function lookPieces(look: Look, map: Map<string, Garment>) {
  return {
    top: look.topId ? map.get(look.topId) : undefined,
    bottom: look.bottomId ? map.get(look.bottomId) : undefined,
    dress: look.dressId ? map.get(look.dressId) : undefined,
    third: look.thirdId ? map.get(look.thirdId) : undefined,
    shoes: map.get(look.shoesId),
    acc: look.accessoryId ? map.get(look.accessoryId) : undefined,
  };
}

/**
 * Valida un look.
 * - mode 'ai': solo reglas duras (la propuesta de la IA prevalece sobre las preferencias del motor).
 * - mode 'strict': además formalidad mínima del estilo, tercera pieza obligatoria y abrigo.
 */
export function validateLook(look: Look, ctx: PlanContext, mode: 'ai' | 'strict' = 'ai'): string[] {
  const map = byId(ctx.items);
  const errors: string[] = [];
  const p = lookPieces(look, map);
  const check = (id: string | undefined, g: Garment | undefined, cat: Category) => {
    if (!id) return;
    if (!g) errors.push(`La prenda indicada como ${CATEGORY_LABEL[cat]} no existe.`);
    else if (g.category !== cat) errors.push(`"${g.name}" no es ${CATEGORY_LABEL[cat]}.`);
  };
  check(look.topId, p.top, 'top');
  check(look.bottomId, p.bottom, 'inferior');
  check(look.dressId, p.dress, 'vestido');
  check(look.thirdId, p.third, 'tercera');
  check(look.shoesId, p.shoes, 'calzado');
  check(look.accessoryId, p.acc, 'accesorio');
  if (!look.shoesId) errors.push('Falta el calzado.');
  if (look.dressId && (look.topId || look.bottomId)) errors.push('Un vestido no se combina con blusa y pantalón/falda a la vez.');
  if (!look.dressId && !(look.topId && look.bottomId)) errors.push('El look necesita un vestido, o blusa + pantalón/falda.');
  if (errors.length) return errors;

  if (ctx.forbiddenSignatures.has(lookSignature(look))) errors.push('Esa combinación ya se usó (Historial u otro día).');
  if (mode === 'ai') return errors;

  const meta = OUTFIT_STYLES[ctx.style];
  const base = (p.dress ? [p.dress] : [p.top!, p.bottom!]) as Garment[];
  const core = [...base, p.shoes!, ...(p.third ? [p.third] : [])];
  if (core.some((g) => g.formality < meta.minFormality)) errors.push(`Incluye una prenda demasiado informal para ${meta.label}.`);
  if (meta.requiresThird && !p.third && ctx.items.some((i) => i.category === 'tercera')) errors.push('Ejecutivo exige tercera pieza.');
  if (!meta.ignoreWeather && warmthOf(base, p.third) < warmthNeed(ctx.weather, parseNote(ctx.note)) - 2.5) {
    errors.push('Abrigo insuficiente para el frío de Bogotá.');
  }
  return errors;
}

function styleFit(g: Garment, style: OutfitStyle): number {
  if (!g.styles?.length) return 0;
  return g.styles.includes(style) ? 3 : -2;
}

function scoreLook(base: Garment[], third: Garment | undefined, shoes: Garment, ctx: PlanContext, intent: NoteIntent, rand: () => number): number {
  const meta = OUTFIT_STYLES[ctx.style];
  const core = [...base, shoes, ...(third ? [third] : [])];
  let s = 0;

  const target = Math.max(1, Math.min(5, meta.formality + intent.formalityBias * 0.75));
  s -= Math.abs(avg(core.map((g) => g.formality)) - target) * 3;
  s += core.reduce((acc, g) => acc + styleFit(g, ctx.style), 0);

  if (meta.ignoreWeather) {
    s -= core.reduce((acc, g) => acc + Math.max(0, g.warmth - 2), 0) * 1.5;
    if (third) s -= 2;
  } else {
    const diff = warmthOf(base, third) - warmthNeed(ctx.weather, intent);
    s += diff < 0 ? diff * 3 : -Math.max(0, diff - 2.5) * 1.2;
    if (isRainy(ctx.weather, intent)) {
      // La lluvia pesa, pero no por encima del estilo pedido (unos tenis siguen siendo lo correcto en Deportivo).
      s += shoes.rainSafe ? 2.5 : -2.5;
      if (third?.rainSafe) s += 2;
    }
  }
  // Oficina cerrada: en Ejecutivo la blusa debe sostener el look sin la tercera pieza.
  if (ctx.style === 'ejecutivo' && base[0].category === 'top') s += base[0].formality >= 3 ? 2 : -2;

  const statement = core.filter((g) => !isNeutral(g.color)).length;
  s += statement === 0 ? 1 : statement === 1 ? 3 : statement === 2 ? 0 : -4;
  if (base.length === 2 && !isNeutral(base[0].color) && base[0].color.toLowerCase() === base[1].color.toLowerCase()) s -= 2;
  if (intent.colors.length && core.some((g) => intent.colors.some((c) => g.color.toLowerCase().includes(c)))) s += 4;

  const isDress = base[0].category === 'vestido';
  const isSkirt = !isDress && /falda/i.test(`${base[1]?.subtype} ${base[1]?.name}`);
  if (intent.wantDress) s += isDress ? 6 : -2;
  if (intent.wantSkirt) s += isSkirt ? 5 : -2;
  if (intent.wantPants) s += !isDress && !isSkirt ? 5 : -2;

  // Variedad: repetir prendas está permitido, pero se prefiere rotar.
  s -= core.filter((g) => ctx.usedElsewhere.has(g.id)).length * 2.5;
  return s + rand() * 2.5;
}

function pickAccessory(ctx: PlanContext, rand: () => number): Garment | undefined {
  const target = OUTFIT_STYLES[ctx.style].formality;
  let best: Garment | undefined;
  let bestScore = -Infinity;
  for (const a of ctx.items.filter((i) => i.category === 'accesorio')) {
    // El accesorio es opcional: si no encaja con el estilo, mejor no llevarlo.
    if (Math.abs(a.formality - target) > 2 && styleFit(a, ctx.style) <= 0) continue;
    const sc = -Math.abs(a.formality - target) + styleFit(a, ctx.style) * 0.5 - (ctx.usedElsewhere.has(a.id) ? 1.5 : 0) + rand();
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  return best;
}

export function describeLook(look: Look, items: Garment[], w: DayWeather, style: OutfitStyle): string {
  const map = byId(items);
  const p = lookPieces(look, map);
  const meta = OUTFIT_STYLES[style];
  const main = p.dress ? p.dress.subtype || p.dress.name : `${p.top?.subtype || p.top?.name} con ${p.bottom?.subtype || p.bottom?.name}`;
  const layer = p.third ? ` y ${p.third.subtype || p.third.name} encima` : '';
  const weather = meta.ignoreWeather ? '' : ` para ${w.min}–${w.max} °C`;
  const rain = !meta.ignoreWeather && w.rainProb >= 50 ? (p.shoes?.rainSafe ? ' · calzado apto para lluvia' : ' · lleva paraguas') : '';
  return `${meta.label}${weather}: ${main}${layer}${rain}.`;
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

/** Arma el mejor look para un día. Si nada cumple el estilo a la perfección, relaja las preferencias y lo advierte. */
export function planDay(ctx: PlanContext, seed: number = Date.now()): PlanResult {
  const rand = mulberry32(seed);
  const intent = parseNote(ctx.note);
  const meta = OUTFIT_STYLES[ctx.style];
  const cat = (c: Category) => ctx.items.filter((i) => i.category === c);
  const tops = cat('top');
  const bottoms = cat('inferior');
  const dresses = cat('vestido');
  const thirds = cat('tercera');
  const shoes = cat('calzado');

  const missing: string[] = [];
  if (!shoes.length) missing.push('Calzado');
  if (!dresses.length && (!tops.length || !bottoms.length)) missing.push('Blusa/Top + Pantalón/Falda, o un Vestido');
  if (missing.length) return { ok: false, error: `Faltan prendas en tu clóset: ${missing.join(' y ')}.` };

  const bases: Garment[][] = [...dresses.map((d) => [d]), ...tops.flatMap((t) => bottoms.map((b) => [t, b]))];
  const thirdOptions: (Garment | undefined)[] = meta.requiresThird && thirds.length ? thirds : [undefined, ...thirds];

  for (const mode of ['strict', 'ai'] as const) {
    let best: { base: Garment[]; third?: Garment; shoes: Garment; score: number } | null = null;
    for (const base of bases) {
      for (const third of thirdOptions) {
        for (const sh of shoes) {
          const candidate: Look = {
            topId: base[0].category === 'top' ? base[0].id : undefined,
            bottomId: base[1]?.id,
            dressId: base[0].category === 'vestido' ? base[0].id : undefined,
            thirdId: third?.id,
            shoesId: sh.id,
            rationale: '',
          };
          if (validateLook(candidate, ctx, mode).length) continue;
          const score = scoreLook(base, third, sh, ctx, intent, rand);
          if (!best || score > best.score) best = { base, third, shoes: sh, score };
        }
      }
    }
    if (!best) continue;
    const acc = pickAccessory(ctx, rand);
    const look: Look = {
      topId: best.base[0].category === 'top' ? best.base[0].id : undefined,
      bottomId: best.base[1]?.id,
      dressId: best.base[0].category === 'vestido' ? best.base[0].id : undefined,
      thirdId: best.third?.id,
      shoesId: best.shoes.id,
      accessoryId: acc?.id,
      rationale: '',
    };
    look.rationale = describeLook(look, ctx.items, ctx.weather, ctx.style);
    const warnings: string[] = [];
    if (mode === 'ai') warnings.push(`No hay prendas ideales para el estilo ${meta.label}; se eligió la combinación más cercana.`);
    if (!meta.ignoreWeather && isRainy(ctx.weather, intent) && !best.shoes.rainSafe) warnings.push('Día lluvioso y no tienes calzado apto para lluvia.');
    return { ok: true, look, warnings };
  }
  return {
    ok: false,
    error: 'Todas las combinaciones posibles ya se usaron (Historial u otros días). Agrega prendas, depura el Historial o activa "Permitir repetir" en este día.',
  };
}
