// Prueba de las reglas del planificador: npm run test:planner
import { planDay, lookItemIds, lookSignature, validateLook, parseNote, type PlanContext } from '../src/lib/planner';
import type { Garment, Category, Level, DayPlan, Look, OutfitStyle } from '../src/lib/types';

let n = 0;
const g = (category: Category, color: string, warmth: number, formality: number, subtype: string, styles: OutfitStyle[] = [], rainSafe = false): Garment => ({
  id: `${category}${++n}`, imageUri: '', createdAt: '', category, subtype, name: `${subtype} ${color}`, color, colorHex: '#000000',
  texture: 'lana', warmth: warmth as Level, formality: formality as Level, rainSafe, aiTagged: false, styles,
});
// Clóset pequeño: obliga a repetir prendas, pero nunca combinaciones.
const items: Garment[] = [
  g('top', 'marfil', 2, 4, 'Blusa de seda', ['ejecutivo', 'elegante']),
  g('top', 'negro', 2, 3, 'Camisa', ['ejecutivo', 'casual']),
  g('top', 'gris', 2, 1, 'Camiseta deportiva', ['deportivo']),
  g('inferior', 'negro', 3, 4, 'Pantalón sastre', ['ejecutivo']),
  g('inferior', 'azul', 2, 1, 'Leggings', ['deportivo']),
  g('vestido', 'vino', 2, 4, 'Vestido midi', ['elegante', 'fiesta', 'ejecutivo']),
  g('tercera', 'camel', 4, 4, 'Abrigo', ['ejecutivo', 'elegante']),
  g('tercera', 'gris', 3, 1, 'Chaqueta deportiva', ['deportivo', 'casual']),
  g('calzado', 'negro', 2, 4, 'Botín de cuero', ['ejecutivo', 'elegante'], true),
  g('calzado', 'blanco', 2, 1, 'Tenis', ['deportivo', 'casual']),
  g('accesorio', 'camel', 1, 4, 'Bolso estructurado', ['ejecutivo']),
];
const weather = { date: '2026-10-19', min: 9, max: 19, rainProb: 70, estimated: false };
const styles: OutfitStyle[] = ['ejecutivo', 'ejecutivo', 'elegante', 'deportivo', 'ejecutivo'];
let days: DayPlan[] = [0, 1, 2, 3, 4].map((i) => ({ dayIndex: i, date: `d${i}`, look: null, locked: false, note: '', style: styles[i] }));
const history = new Set<string>();

function ctxFor(i: number, opts: { note?: string; avoidCurrent?: boolean; allowRepeat?: boolean } = {}): PlanContext {
  const forbidden = new Set<string>();
  const used = new Set<string>();
  for (const d of days) {
    if (d.dayIndex === i || !d.look) continue;
    lookItemIds(d.look).forEach((id) => used.add(id));
    if (!opts.allowRepeat) forbidden.add(lookSignature(d.look));
  }
  if (!opts.allowRepeat) history.forEach((s) => forbidden.add(s));
  if (opts.avoidCurrent && days[i].look) forbidden.add(lookSignature(days[i].look!));
  return { items, weather, style: days[i].style!, forbiddenSignatures: forbidden, usedElsewhere: used, note: opts.note ?? '' };
}
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

for (let i = 0; i < 5; i++) {
  const r = planDay(ctxFor(i), i + 1);
  if (!r.ok) throw new Error(`día ${i}: ${r.error}`);
  days[i] = { ...days[i], look: r.look };
  console.log(i, days[i].style, lookItemIds(r.look).join(','), r.warnings.join(' | '));
}
const sigs = days.map((d) => lookSignature(d.look!));
assert(new Set(sigs).size === 5, 'una combinación se repitió dentro de la semana');
const allItems = days.flatMap((d) => lookItemIds(d.look).filter((id) => !id.startsWith('accesorio')));
assert(new Set(allItems).size < allItems.length, 'con un clóset pequeño se esperaba repetir alguna prenda');
const dep = days[3].look!;
assert(dep.shoesId === 'calzado10' && (dep.topId === 'top3' || dep.bottomId === 'inferior5'), 'el día deportivo no usó prendas deportivas');
assert(days.filter((d) => d.style === 'ejecutivo').every((d) => !!d.look!.thirdId), 'Ejecutivo debe llevar tercera pieza');

// Regenerar solo el jueves: los demás días no cambian y la combinación nueva no repite ninguna.
const before = JSON.stringify(days.filter((d) => d.dayIndex !== 3).map((d) => d.look));
const r = planDay(ctxFor(3, { avoidCurrent: true }), 99);
assert(r.ok, 'no se pudo regenerar el jueves');
if (r.ok) days[3] = { ...days[3], look: r.look };
assert(JSON.stringify(days.filter((d) => d.dayIndex !== 3).map((d) => d.look)) === before, 'se modificaron otros días');
assert(new Set(days.map((d) => lookSignature(d.look!))).size === 5, 'el jueves regenerado repite una combinación');
console.log('jueves regenerado:', lookItemIds(days[3].look).join(','));

// Historial: la combinación guardada queda prohibida, salvo que la usuaria pida repetir.
days.forEach((d) => history.add(lookSignature(d.look!)));
assert(validateLook(days[0].look!, ctxFor(0)).some((e) => e.includes('ya se usó')), 'no detecta combinación del Historial');
assert(validateLook(days[0].look!, ctxFor(0, { allowRepeat: true })).length === 0, 'allowRepeat debería permitir repetir');
assert(parseNote('Quiero repetir el look del lunes').wantRepeat, 'la nota "repetir" no se detecta');

// La IA prevalece: un look válido estructuralmente se acepta aunque no sea el ideal para el estilo.
const aiLook: Look = { topId: 'top3', bottomId: 'inferior5', shoesId: 'calzado9', rationale: 'IA' };
const ctxExec = { ...ctxFor(1), style: 'ejecutivo' as OutfitStyle, forbiddenSignatures: new Set<string>() };
assert(validateLook(aiLook, ctxExec, 'ai').length === 0, 'la propuesta de la IA debería prevalecer');
assert(validateLook(aiLook, ctxExec, 'strict').length > 0, 'el modo estricto debería objetar ese look ejecutivo');
assert(validateLook({ dressId: 'vestido6', topId: 'top1', shoesId: 'calzado9', rationale: '' }, ctxExec, 'ai').length > 0, 'vestido + blusa debe rechazarse');
console.log('OK: reglas verificadas');

// Contexto de perfil inyectado en los prompts de Gemini.
import { profileContext } from '../src/lib/prompts';
import { EMPTY_PROFILE } from '../src/lib/types';
assert(profileContext(null) === '' && !profileContext(EMPTY_PROFILE).includes('Altura'), 'perfil vacío no debe inyectar datos');
const pc = profileContext({ ...EMPTY_PROFILE, name: 'Ana', heightCm: 165, bodyType: 'pera', skinSeason: 'otono', undertone: 'calido' });
for (const k of ['Ana', '165 cm', 'Pera', 'Otoño', 'subtono cálido']) assert(pc.includes(k), `falta "${k}" en el contexto de perfil`);
console.log('OK: contexto de perfil');
