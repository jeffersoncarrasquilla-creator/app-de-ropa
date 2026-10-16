import type { UserProfile } from './types';
import { BODY_TYPES, SKIN_SEASONS, UNDERTONES } from './types';

/**
 * Bloque de contexto personal que se inyecta en los prompts de Gemini para adaptar
 * las recomendaciones a la fisonomía, colorimetría y contexto profesional de la usuaria.
 * Solo incluye los datos que la usuaria diligenció.
 */
export function profileContext(p: UserProfile | null): string {
  if (!p) return '';
  const lines: string[] = [];
  const add = (label: string, v: string | number | null | undefined, unit = '') => {
    if (v !== null && v !== undefined && v !== '') lines.push(`- ${label}: ${v}${unit}`);
  };
  add('Nombre', p.name);
  add('Edad', p.age, ' años');
  add('Profesión', p.profession);
  add('Estilo personal preferido', p.style);
  add('Altura', p.heightCm, ' cm');
  add('Peso', p.weightKg, ' kg');
  const body = BODY_TYPES.find((b) => b.key === p.bodyType);
  if (body) add('Tipo de cuerpo', `${body.label} (${body.hint.toLowerCase()})`);
  const m = [p.bustCm && `busto ${p.bustCm}`, p.waistCm && `cintura ${p.waistCm}`, p.hipCm && `cadera ${p.hipCm}`].filter(Boolean);
  if (m.length) add('Medidas (cm)', m.join(', '));
  const season = SKIN_SEASONS.find((s) => s.key === p.skinSeason);
  const under = UNDERTONES.find((u) => u.key === p.undertone);
  if (season || under) {
    add('Colorimetría', [season && `${season.label} (${season.hint.toLowerCase()})`, under && `subtono ${under.label.toLowerCase()}`].filter(Boolean).join(', '));
  }
  if (!lines.length) return '';
  return `PERFIL DE LA USUARIA (personaliza según su fisonomía, colorimetría y contexto profesional; favorece siluetas que equilibren su tipo de cuerpo y colores de su estación cerca del rostro):
${lines.join('\n')}`;
}
