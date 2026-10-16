// Prueba de humo del motor de reglas: npx tsx scripts/planner-check.ts
import { planDay, lookItemIds, lookSignature, validateLook } from '../src/lib/planner';
import type { Garment, Category, Level, DayPlan } from '../src/lib/types';

let n = 0;
const g = (category: Category, color: string, warmth: number, formality: number, rainSafe = false, subtype = ''): Garment => ({
  id: `${category}${++n}`, imageUri: '', createdAt: '', category, subtype: subtype || category, name: `${category} ${color} ${n}`,
  color, colorHex: '#000000', texture: 'lana', warmth: warmth as Level, formality: formality as Level, rainSafe, aiTagged: false,
});
const items: Garment[] = [
  ...['marfil', 'blanco', 'negro', 'gris', 'vino', 'azul marino'].map((c, i) => g('top', c, 2, 3 + (i % 2))),
  ...['camel', 'negro', 'gris', 'azul marino', 'beige', 'taupe'].map((c, i) => g('tercera', c, 3 + (i % 3), 4, i === 1, i % 2 ? 'Abrigo' : 'Blazer')),
  ...['negro', 'gris', 'beige', 'azul marino', 'camel', 'negro'].map((c, i) => g('inferior', c, 3, 4, false, i === 5 ? 'Falda lápiz' : 'Pantalón sastre')),
  g('calzado', 'negro', 2, 4, true), g('calzado', 'camel', 2, 4), g('calzado', 'nude', 1, 5),
  g('accesorio', 'negro', 1, 4), g('accesorio', 'camel', 1, 4),
];
const weather = { date: '2026-10-19', min: 9, max: 19, rainProb: 70, estimated: false };
let days: DayPlan[] = [0, 1, 2, 3, 4].map((i) => ({ dayIndex: i, date: `d${i}`, look: null, locked: false, note: '' }));
const history = new Set<string>();
function ctxFor(i: number, note = '', avoid = new Set<string>()) {
  const exclude = new Set<string>();
  days.forEach((d) => d.dayIndex !== i && lookItemIds(d.look).forEach((id) => exclude.add(id)));
  return { items, weather, exclude, historySignatures: history, avoidSignatures: avoid, note };
}
for (let i = 0; i < 5; i++) {
  const r = planDay(ctxFor(i), i + 1);
  if (!r.ok) throw new Error(`día ${i}: ${r.error}`);
  days[i] = { ...days[i], look: r.look };
  console.log(i, lookItemIds(r.look).join(','), r.warnings.join(' | '));
}
const main = days.flatMap((d) => [d.look!.topId, d.look!.thirdId, d.look!.bottomId]);
if (new Set(main).size !== main.length) throw new Error('prenda principal repetida en la semana');
// Regenerar solo el jueves con nota.
const before = JSON.stringify(days.filter((d) => d.dayIndex !== 3).map((d) => d.look));
const thu = days[3];
const r = planDay(ctxFor(3, 'Elegante y solo para el jueves, falda', new Set([lookSignature(thu.look!)])), 99);
if (!r.ok) throw new Error(r.error);
days[3] = { ...thu, look: r.look };
if (JSON.stringify(days.filter((d) => d.dayIndex !== 3).map((d) => d.look)) !== before) throw new Error('se modificaron otros días');
if (validateLook(r.look, ctxFor(3), true).length) throw new Error('jueves inválido');
console.log('jueves regenerado:', lookItemIds(r.look).join(','));
// Historial: el mismo look no puede volver a salir.
days.forEach((d) => history.add(lookSignature(d.look!)));
const v = validateLook(days[0].look!, { ...ctxFor(0), historySignatures: history }, false);
if (!v.some((e) => e.includes('Historial'))) throw new Error('no detecta repetición de historial');
console.log('OK: reglas verificadas');

// Contexto de perfil inyectado en los prompts de Gemini.
import { profileContext } from '../src/lib/prompts';
import { EMPTY_PROFILE } from '../src/lib/types';
if (profileContext(null) !== '' || profileContext(EMPTY_PROFILE).includes('Altura')) throw new Error('perfil vacío no debe inyectar datos');
const pc = profileContext({ ...EMPTY_PROFILE, name: 'Ana', heightCm: 165, bodyType: 'pera', skinSeason: 'otono', undertone: 'calido' });
for (const k of ['Ana', '165 cm', 'Pera', 'Otoño', 'subtono cálido']) if (!pc.includes(k)) throw new Error(`falta "${k}" en el contexto de perfil`);
console.log('OK: contexto de perfil');
