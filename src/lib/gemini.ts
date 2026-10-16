import type { PlanContext } from './planner';
import { parseNote, warmthNeed } from './planner';
import type { Category, Garment, Level, Look, OutfitStyle, UserProfile } from './types';
import { profileContext } from './prompts';
import { CATEGORY_LABEL, OUTFIT_STYLE_ORDER, OUTFIT_STYLES } from './types';

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
  styles: OutfitStyle[];
  multipleInPhoto: boolean;
}

const CATEGORY_FROM_LABEL: Record<string, Category> = Object.fromEntries(
  (Object.entries(CATEGORY_LABEL) as [Category, string][]).map(([k, v]) => [v, k]),
);
const STYLE_FROM_LABEL: Record<string, OutfitStyle> = Object.fromEntries(
  OUTFIT_STYLE_ORDER.map((k) => [OUTFIT_STYLES[k].label, k]),
);

function clampLevel(n: unknown): Level {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, v)) as Level;
}

const RETRY_DELAYS_MS = [2000, 5000, 10000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
type GeminiBody = {
  error?: { message?: string };
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
} | null;

/**
 * POST a generateContent con reintentos ante fallos transitorios (alta demanda, límite por minuto,
 * errores del servidor). Una cuota agotada no se reintenta y se explica con un mensaje claro.
 */
async function requestGemini(apiKey: string, model: string, payload: object): Promise<NonNullable<GeminiBody>> {
  if (!apiKey) throw new Error('Configura tu API Key de Gemini en Historial/Ajustes.');
  const request = () =>
    fetch(`${ENDPOINT}/${encodeURIComponent(model.trim())}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
    });

  let res: Response;
  let body: GeminiBody;
  for (let attempt = 0; ; attempt++) {
    res = await request();
    body = (await res.json().catch(() => null)) as GeminiBody;
    const msg = body?.error?.message ?? '';
    const quotaExhausted = /limit: 0|per day|PerDay|exceeded your current quota|billing/i.test(msg);
    const transient = res.status === 429 || res.status === 500 || res.status === 503 || (res.status === 403 && /caller does not have permission/i.test(msg));
    if (res.ok || !transient || quotaExhausted || attempt >= RETRY_DELAYS_MS.length) break;
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 404) throw new Error(`Modelo "${model}" no disponible: ${msg}. Cámbialo en Ajustes.`);
    if (res.status === 429 && /limit: 0|exceeded your current quota|billing/i.test(msg)) {
      throw new Error(`Tu plan de Gemini no tiene cuota para "${model}". Activa la facturación en Google AI Studio o cambia el modelo en Ajustes.`);
    }
    if (res.status === 429) throw new Error(`Se alcanzó el límite de uso de Gemini para "${model}". Intenta más tarde.`);
    if (res.status === 503) throw new Error(`El modelo "${model}" está saturado en este momento. Intenta de nuevo en unos minutos.`);
    if (res.status === 400 || res.status === 403) throw new Error(`Gemini rechazó la solicitud (API Key o modelo): ${msg}`);
    throw new Error(`Error de Gemini: ${msg}`);
  }
  if (body?.promptFeedback?.blockReason) throw new Error(`Gemini bloqueó la solicitud: ${body.promptFeedback.blockReason}`);
  return body ?? {};
}

async function callGemini(apiKey: string, model: string, parts: unknown[], schema: object, temperature: number): Promise<unknown> {
  const body = await requestGemini(apiKey, model, {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
  });
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini no devolvió contenido.');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini devolvió un JSON inválido.');
  }
}

const STYLE_LABELS = OUTFIT_STYLE_ORDER.map((k) => OUTFIT_STYLES[k].label);

const TAG_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categoria: { type: 'STRING', enum: Object.values(CATEGORY_LABEL) },
    subtipo: { type: 'STRING', description: 'Ej.: Blazer, Abrigo, Blusa de seda, Pantalón sastre, Falda lápiz, Vestido midi, Leggings, Tenis, Botín, Bolso tote.' },
    nombre: { type: 'STRING', description: 'Nombre corto y descriptivo en español, máx. 5 palabras.' },
    color: { type: 'STRING', description: 'Color principal en español (p. ej. "azul marino", "camel", "marfil").' },
    colorHex: { type: 'STRING', description: 'Color principal en hexadecimal #RRGGBB.' },
    textura: { type: 'STRING', description: 'Textura o tejido: lana, crepé, seda, punto, cuero, tweed, algodón, lino, licra, etc.' },
    abrigoTermico: { type: 'INTEGER', description: '1 = muy fresco, 5 = muy abrigado.' },
    formalidad: { type: 'INTEGER', description: '1 = deportivo/playa, 3 = casual arreglado, 5 = máxima formalidad.' },
    aptoLluvia: { type: 'BOOLEAN' },
    estilos: { type: 'ARRAY', items: { type: 'STRING', enum: STYLE_LABELS }, description: 'Estilos de outfit en los que esta prenda encaja bien.' },
    variasPrendas: { type: 'BOOLEAN', description: 'true si la foto muestra más de una prenda principal.' },
  },
  required: ['categoria', 'subtipo', 'nombre', 'color', 'colorHex', 'textura', 'abrigoTermico', 'formalidad', 'aptoLluvia', 'estilos', 'variasPrendas'],
};

const TAG_PROMPT = `Eres estilista personal. Analiza la prenda de la foto y clasifícala para el clóset de la usuaria (vive en Bogotá: 9 °C a 19 °C, lluvia frecuente).
Categorías permitidas:
- "Blusa/Top": blusas, camisas, camisetas, suéteres, tops deportivos.
- "Tercera pieza": blazer, abrigo, gabardina, chaqueta, cárdigan, chaleco.
- "Pantalón sastre/Falda": pantalones, jeans, faldas, shorts, leggings.
- "Vestido": vestidos y enterizos de una pieza.
- "Calzado": zapatos, botines, tenis, sandalias, tacones.
- "Bolso/Accesorio": bolsos, cinturones, pañoletas, joyería.
Si la foto muestra varias prendas, clasifica la más visible y marca "variasPrendas" = true.
Califica abrigo térmico (1-5) y formalidad (1-5). "aptoLluvia" es true solo si el material resiste agua.
En "estilos" indica todos los estilos de outfit en los que la prenda encaja (${STYLE_LABELS.join(', ')}).
Responde únicamente con el JSON solicitado, en español.`;

/** Etiqueta automáticamente una prenda a partir de su foto JPEG (base64). */
export async function tagGarment(apiKey: string, model: string, jpegBase64: string, profile: UserProfile | null = null): Promise<GarmentTags> {
  const ctx = profileContext(profile);
  const raw = (await callGemini(
    apiKey,
    model,
    [{ text: ctx ? `${TAG_PROMPT}\n\nCalifica la formalidad pensando en su profesión y estilo.\n${ctx}` : TAG_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } }],
    TAG_SCHEMA,
    0.2,
  )) as Record<string, unknown>;
  const hex = String(raw.colorHex ?? '');
  const styles = Array.isArray(raw.estilos) ? (raw.estilos as unknown[]).map((s) => STYLE_FROM_LABEL[String(s)]).filter(Boolean) : [];
  return {
    category: CATEGORY_FROM_LABEL[String(raw.categoria)] ?? 'top',
    subtype: String(raw.subtipo ?? '').slice(0, 40),
    name: String(raw.nombre ?? raw.subtipo ?? 'Prenda').slice(0, 60),
    color: String(raw.color ?? '').toLowerCase().slice(0, 30),
    colorHex: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#A39382',
    texture: String(raw.textura ?? '').toLowerCase().slice(0, 30),
    warmth: clampLevel(raw.abrigoTermico),
    formality: clampLevel(raw.formalidad ?? raw.formalidadEjecutiva),
    rainSafe: raw.aptoLluvia === true,
    styles: [...new Set(styles)],
    multipleInPhoto: raw.variasPrendas === true,
  };
}

const LOOK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    dressId: { type: 'STRING', description: 'Id del vestido, o cadena vacía si usas blusa + inferior.' },
    topId: { type: 'STRING', description: 'Cadena vacía si usas vestido.' },
    bottomId: { type: 'STRING', description: 'Cadena vacía si usas vestido.' },
    thirdId: { type: 'STRING', description: 'Cadena vacía si no hace falta tercera pieza.' },
    shoesId: { type: 'STRING' },
    accessoryId: { type: 'STRING', description: 'Cadena vacía si no usas accesorio.' },
    justificacion: { type: 'STRING', description: 'Máx. 35 palabras, en español.' },
  },
  required: ['dressId', 'topId', 'bottomId', 'thirdId', 'shoesId', 'accessoryId', 'justificacion'],
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
    estilos: g.styles?.map((s) => OUTFIT_STYLES[s].label),
  }));
}

/**
 * Pide a Gemini el look de UN día. Las combinaciones ya usadas (otros días y Historial) se envían
 * como prohibidas; las prendas sí pueden repetirse. Su propuesta prevalece sobre el motor local:
 * solo se descarta si viola una regla dura (ver validateLook en modo 'ai').
 */
export async function suggestLookWithGemini(
  apiKey: string,
  model: string,
  ctx: PlanContext,
  dayLabel: string,
  profile: UserProfile | null = null,
): Promise<Look> {
  const personal = profileContext(profile);
  const meta = OUTFIT_STYLES[ctx.style];
  const w = ctx.weather;
  const climate = meta.ignoreWeather
    ? 'El estilo es Playa: asume clima cálido, ignora el frío de Bogotá.'
    : `Clima en Bogotá: mínima ${w.min} °C, máxima ${w.max} °C, lluvia ${w.rainProb} %. Abrigo requerido aproximado (torso + tercera pieza + 0,5 × inferior) ≈ ${warmthNeed(w, parseNote(ctx.note))}.`;
  const prompt = `Eres estilista personal. Arma UN outfit estilo "${meta.label}" (${meta.hint}) SOLO para ${dayLabel} (${w.date}).
${climate}

REGLAS:
1. Usa un "Vestido" (dressId) O la pareja "Blusa/Top" (topId) + "Pantalón sastre/Falda" (bottomId), nunca ambos. "Calzado" (shoesId) obligatorio.
2. "Tercera pieza" (thirdId) ${meta.requiresThird ? 'obligatoria si existe en el inventario' : 'solo si el clima o el estilo la piden'}. "Bolso/Accesorio" (accessoryId) opcional.
3. Las prendas SÍ pueden repetirse respecto a otros días, pero prefiere variar. Prendas ya usadas otros días esta semana: ${JSON.stringify([...ctx.usedElsewhere])}.
4. PROHIBIDO repetir estas combinaciones (ids de vestido/blusa, inferior, tercera pieza y calzado, ordenados y unidos por "|"): ${JSON.stringify([...ctx.forbiddenSignatures])}.
5. Formalidad acorde al estilo ${meta.label} (objetivo ≈ ${meta.formality} de 5).
6. Usa solo ids del inventario y deja en cadena vacía los campos que no uses.

Nota rápida de la usuaria para este día (respétala): "${ctx.note || 'sin nota'}".
${personal ? `\n${personal}\nEn la justificación menciona brevemente por qué el look favorece su tipo de cuerpo o su colorimetría.\n` : ''}
INVENTARIO (JSON): ${JSON.stringify(compactInventory(ctx.items))}`;

  const raw = (await callGemini(apiKey, model, [{ text: prompt }], LOOK_SCHEMA, 0.7)) as Record<string, unknown>;
  const id = (k: string) => (raw[k] ? String(raw[k]).trim() || undefined : undefined);
  return {
    dressId: id('dressId'),
    topId: id('dressId') ? undefined : id('topId'),
    bottomId: id('dressId') ? undefined : id('bottomId'),
    thirdId: id('thirdId'),
    shoesId: id('shoesId') ?? '',
    accessoryId: id('accessoryId'),
    rationale: String(raw.justificacion ?? '').slice(0, 280),
  };
}

export interface TryOnGarment {
  label: string;
  base64: string;
}

/**
 * Probador virtual: genera una foto realista de la usuaria (o de una modelo con su fisonomía)
 * vistiendo exactamente las prendas del look. Requiere un modelo de imagen de Gemini con cuota
 * (en el plan gratuito suele no estar disponible: hace falta activar la facturación).
 */
export async function generateTryOn(
  apiKey: string,
  model: string,
  garments: TryOnGarment[],
  profile: UserProfile | null,
  bodyPhotoBase64: string | null,
  styleLabel: string,
): Promise<{ base64: string; mimeType: string }> {
  const personal = profileContext(profile);
  const intro = bodyPhotoBase64
    ? 'La PRIMERA imagen es una foto de cuerpo entero de la usuaria. Genera una foto realista de ESA MISMA persona (mismo rostro, tono de piel, cabello y complexión) vistiendo las prendas de las imágenes siguientes.'
    : 'Genera una foto realista de cuerpo entero de una mujer real que corresponda al perfil descrito, vistiendo las prendas de las imágenes siguientes.';
  const parts: unknown[] = [
    {
      text: `${intro}
Reproduce cada prenda con fidelidad (color, textura, largo, corte y detalles); no inventes prendas que no estén en las imágenes.
Look estilo ${styleLabel}. Prendas, en orden: ${garments.map((g, i) => `${i + 1}. ${g.label}`).join('; ')}.
Fotografía de moda editorial, luz natural suave, fondo neutro marfil, postura natural de pie, vista frontal completa de cabeza a pies, formato vertical 3:4.
${personal}`,
    },
  ];
  if (bodyPhotoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: bodyPhotoBase64 } });
  for (const g of garments) parts.push({ inline_data: { mime_type: 'image/jpeg', data: g.base64 } });

  const body = await requestGemini(apiKey, model, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 0.4 },
  });
  for (const p of body.candidates?.[0]?.content?.parts ?? []) {
    const data = p.inlineData?.data ?? p.inline_data?.data;
    if (data) return { base64: data, mimeType: p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? 'image/png' };
  }
  const why = body.candidates?.[0]?.finishReason;
  throw new Error(`Gemini no devolvió una imagen${why ? ` (${why})` : ''}. Intenta de nuevo o cambia el modelo de imagen en Ajustes.`);
}

/** Prueba rápida de conexión con el modelo configurado. */
export async function pingGemini(apiKey: string, model: string): Promise<void> {
  await callGemini(apiKey, model, [{ text: 'Responde {"ok": true}' }], { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] }, 0);
}
