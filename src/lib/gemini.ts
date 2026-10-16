import type { PlanContext } from './planner';
import { parseNote, warmthNeed } from './planner';
import type { Category, Garment, Level, Look, UserProfile } from './types';
import { profileContext } from './prompts';
import { CATEGORY_LABEL } from './types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GarmentTags {
  category: Category;
  subtype: string;
  name: string;
  color: string;
  colorHex: string;
  texture: string;
  warmth: Level;
  formality: Level;
  rainSafe: boolean;
}

const CATEGORY_FROM_LABEL: Record<string, Category> = {
  'Blusa/Top': 'top',
  'Tercera pieza': 'tercera',
  'Pantalón sastre/Falda': 'inferior',
  Calzado: 'calzado',
  'Bolso/Accesorio': 'accesorio',
};

function clampLevel(n: unknown): Level {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v)) as Level;
}

async function callGemini(apiKey: string, model: string, parts: unknown[], schema: object, temperature: number): Promise<unknown> {
  if (!apiKey) throw new Error('Configura tu API Key de Gemini en Historial/Ajustes.');
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model.trim())}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  } | null;
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 404) throw new Error(`Modelo "${model}" no disponible: ${msg}. Cámbialo en Ajustes.`);
    if (res.status === 400 || res.status === 403) throw new Error(`Gemini rechazó la solicitud (API Key o modelo): ${msg}`);
    throw new Error(`Error de Gemini: ${msg}`);
  }
  if (body?.promptFeedback?.blockReason) throw new Error(`Gemini bloqueó la solicitud: ${body.promptFeedback.blockReason}`);
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini no devolvió contenido.');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini devolvió un JSON inválido.');
  }
}

const TAG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categoria: { type: 'STRING', enum: Object.values(CATEGORY_LABEL) },
    subtipo: { type: 'STRING', description: 'Ej.: Blazer, Abrigo, Gabardina, Blusa de seda, Pantalón sastre, Falda lápiz, Mocasín, Botín, Bolso tote.' },
    nombre: { type: 'STRING', description: 'Nombre corto y descriptivo en español, máx. 5 palabras.' },
    color: { type: 'STRING', description: 'Color principal en español (p. ej. "azul marino", "camel", "marfil").' },
    colorHex: { type: 'STRING', description: 'Color principal en hexadecimal #RRGGBB.' },
    textura: { type: 'STRING', description: 'Textura o tejido: lana, crepé, seda, punto, cuero, tweed, algodón, etc.' },
    abrigoTermico: { type: 'INTEGER', description: '1 = muy fresco, 5 = muy abrigado.' },
    formalidadEjecutiva: { type: 'INTEGER', description: '1 = casual, 5 = máxima formalidad ejecutiva.' },
    aptoLluvia: { type: 'BOOLEAN' },
  },
  required: ['categoria', 'subtipo', 'nombre', 'color', 'colorHex', 'textura', 'abrigoTermico', 'formalidadEjecutiva', 'aptoLluvia'],
};

const TAG_PROMPT = `Eres estilista de imagen ejecutiva. Analiza la prenda de la foto y clasifícala para un armario cápsula ejecutivo en Bogotá (9 °C a 19 °C, lluvia frecuente, oficinas cerradas).
Categorías permitidas:
- "Blusa/Top": blusas, camisas, suéteres finos, tops.
- "Tercera pieza": blazer, abrigo, gabardina, chaqueta, cárdigan estructurado, chaleco.
- "Pantalón sastre/Falda": pantalones, faldas, culottes.
- "Calzado": zapatos, botines, mocasines, tacones.
- "Bolso/Accesorio": bolsos, cinturones, pañoletas, joyería.
Califica abrigo térmico (1-5) y formalidad ejecutiva (1-5). "aptoLluvia" es true solo si el material resiste agua (cuero tratado, charol, gabardina impermeable, suela de caucho, etc.).
Responde únicamente con el JSON solicitado, en español.`;

/** Etiqueta automáticamente una prenda a partir de su foto JPEG (base64). */
export async function tagGarment(
  apiKey: string,
  model: string,
  jpegBase64: string,
  profile: UserProfile | null = null,
): Promise<GarmentTags> {
  const ctx = profileContext(profile);
  const raw = (await callGemini(
    apiKey,
    model,
    [{ text: ctx ? `${TAG_PROMPT}\n\nCalifica la formalidad pensando en su profesión y estilo.\n${ctx}` : TAG_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } }],
    TAG_SCHEMA,
    0.2,
  )) as Record<string, unknown>;
  const category = CATEGORY_FROM_LABEL[String(raw.categoria)] ?? 'top';
  const hex = String(raw.colorHex ?? '');
  return {
    category,
    subtype: String(raw.subtipo ?? '').slice(0, 40),
    name: String(raw.nombre ?? raw.subtipo ?? 'Prenda').slice(0, 60),
    color: String(raw.color ?? '').toLowerCase().slice(0, 30),
    colorHex: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#A39382',
    texture: String(raw.textura ?? '').toLowerCase().slice(0, 30),
    warmth: clampLevel(raw.abrigoTermico),
    formality: clampLevel(raw.formalidadEjecutiva),
    rainSafe: raw.aptoLluvia === true,
  };
}

const LOOK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topId: { type: 'STRING' },
    thirdId: { type: 'STRING' },
    bottomId: { type: 'STRING' },
    shoesId: { type: 'STRING' },
    accessoryId: { type: 'STRING', description: 'Cadena vacía si no hay accesorio libre.' },
    justificacion: { type: 'STRING', description: 'Máx. 35 palabras, en español.' },
  },
  required: ['topId', 'thirdId', 'bottomId', 'shoesId', 'accessoryId', 'justificacion'],
};

function compactInventory(items: Garment[]) {
  return items.map((g) => ({
    id: g.id,
    categoria: CATEGORY_LABEL[g.category],
    subtipo: g.subtype,
    nombre: g.name,
    color: g.color,
    textura: g.texture,
    abrigo: g.warmth,
    formalidad: g.formality,
    aptoLluvia: g.rainSafe,
  }));
}

/**
 * Pide a Gemini un look para UN solo día. Las prendas de los otros 4 días se envían como
 * lista de exclusión obligatoria. La respuesta se valida después con el motor de reglas local.
 */
export async function suggestLookWithGemini(
  apiKey: string,
  model: string,
  ctx: PlanContext,
  dayLabel: string,
  profile: UserProfile | null = null,
): Promise<Look> {
  const personal = profileContext(profile);
  const excluded = [...ctx.exclude];
  const forbiddenLooks = [...ctx.historySignatures, ...ctx.avoidSignatures];
  const w = ctx.weather;
  const prompt = `Eres estilista de imagen ejecutiva en Bogotá. Arma UN look ejecutivo por capas SOLO para ${dayLabel} (${w.date}).
Clima: mínima ${w.min} °C, máxima ${w.max} °C, probabilidad de lluvia ${w.rainProb} %. Trabajo en oficina cerrada: la tercera pieza se quita en interiores, así que la blusa debe verse ejecutiva sola.
Abrigo requerido (abrigo blusa + abrigo tercera pieza + 0,5 × abrigo inferior) ≈ ${warmthNeed(w, parseNote(ctx.note))}.

REGLAS OBLIGATORIAS:
1. Usa exactamente: 1 "Blusa/Top" (topId), 1 "Tercera pieza" (thirdId), 1 "Pantalón sastre/Falda" (bottomId), 1 "Calzado" (shoesId) y opcionalmente 1 "Bolso/Accesorio" (accessoryId).
2. LISTA DE EXCLUSIÓN OBLIGATORIA (prendas de los otros días de la semana; NO puedes usar ninguna): ${JSON.stringify(excluded)}.
3. Prohibido repetir looks completos del historial. Firmas prohibidas (ids de top, tercera, inferior y calzado ordenados y unidos por "|"): ${JSON.stringify(forbiddenLooks)}.
4. Formalidad ejecutiva promedio mínima 3 y ninguna prenda con formalidad 1.
5. Si llueve (≥ 50 %), prioriza calzado y tercera pieza aptos para lluvia.
6. Usa solo ids del inventario.

Nota rápida de la usuaria para este día (respétala): "${ctx.note || 'sin nota'}".
${personal ? `\n${personal}\nEn la justificación menciona brevemente por qué el look favorece su tipo de cuerpo o su colorimetría.\n` : ''}

INVENTARIO (JSON): ${JSON.stringify(compactInventory(ctx.items))}`;

  const raw = (await callGemini(apiKey, model, [{ text: prompt }], LOOK_SCHEMA, 0.7)) as Record<string, unknown>;
  const look: Look = {
    topId: String(raw.topId ?? ''),
    thirdId: String(raw.thirdId ?? ''),
    bottomId: String(raw.bottomId ?? ''),
    shoesId: String(raw.shoesId ?? ''),
    accessoryId: raw.accessoryId ? String(raw.accessoryId) : undefined,
    rationale: String(raw.justificacion ?? '').slice(0, 280),
  };
  return look;
}

/** Prueba rápida de conexión con el modelo configurado. */
export async function pingGemini(apiKey: string, model: string): Promise<void> {
  await callGemini(
    apiKey,
    model,
    [{ text: 'Responde {"ok": true}' }],
    { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] },
    0,
  );
}
