# PROJECT_MAP: My Closet

Mapa indexado del proyecto (nombre visible: "My Closet"; slug/bundle internos siguen como `capsula-ejecutiva`). Léelo antes de buscar archivos (ver `CLAUDE.md`).
Stack: Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router (`src/app/`) · web/PWA.
Arquitectura: pantallas (`src/app`) → componentes (`src/components`) → estado global (`src/lib/store.tsx`, Context) → servicios puros (`src/lib/*`).

## Árbol y responsabilidades

```
app.json / app.config.ts     Config Expo (nombre, permisos cámara/fotos, plugins); EXPO_BASE_URL → baseUrl web
CLAUDE.md                    Memoria y reglas para Claude Code
PROJECT_MAP.md               Este mapa
src/app/                     RUTAS (Expo Router)
  _layout.tsx                Raíz: SafeArea + StoreProvider + puerta de onboarding + Tabs (3 pestañas) + DialogHost
  index.tsx                  Pestaña "Mi Clóset": grilla, filtros, botón +, ingestOne (editor) / ingestBatch (cola)
  semana.tsx                 Pestaña "Semana": generar semana, guardar en Historial, lista de DayCard
  ajustes.tsx                Pestaña "Historial/Ajustes": historial; Mi perfil (resumen + Sheet con ProfileForm),
                             API Key/modelo, planificador, borrar datos (conserva perfil y API Key)
  +not-found.tsx             Redirige rutas desconocidas a "/" (oculta en tabs)
src/components/
  ui.tsx                     Sistema de diseño: Button, IconButton, Chip, Toggle, LevelDots, Sheet, ScreenHeader,
                             LoadingOverlay, DialogHost + notify()/confirmAction() (modal propio en web)
  GarmentImage.tsx           Miniatura de prenda con fallback
  GarmentEditor.tsx          Hoja para revisar/editar etiquetas de una prenda
  DayCard.tsx                Tarjeta diaria: piezas, clima, candado, nota rápida, "Regenerar solo este día"
  Welcome.tsx                Bienvenida (eslogan) + flujo de onboarding por pasos
  ProfileForm.tsx            Formulario de perfil (datos básicos + biométricos), reutilizado en onboarding y Ajustes
src/lib/
  theme.ts                   Tokens de color, tipografía y espaciado (NO cambiar valores validados)
  types.ts                   Modelos de dominio (ver abajo) y constantes (categorías, días, defaults)
  kv.ts                      Persistencia clave-valor: AsyncStorage (iOS) / IndexedDB (web)
  secrets.ts                 API Key de Gemini en SecureStore (iOS) / IndexedDB (web)
  images.ts                  Selector (cámara / fototeca, selección múltiple), HEIC→JPEG, compresión, archivo local
  gemini.ts                  Cliente Gemini: tagGarment (visión→JSON), suggestLookWithGemini, pingGemini;
                             callGemini reintenta 429/500/503 (2s, 5s, 10s) y explica cuota agotada
  prompts.ts                 Prompts de IA y bloque de contexto del perfil (profileContext)
  planner.ts                 Motor de reglas: planDay, validateLook, lookSignature, parseNote, warmthNeed
  weather.ts                 Pronóstico Open-Meteo Bogotá + climatología de respaldo (9–19 °C)
  dates.ts                   Lunes de la semana, fechas cortas/largas
  store.tsx                  StoreProvider/useStore: prendas, semana, historial, ajustes, perfil, API Key; acciones
scripts/
  planner-check.ts           Prueba de reglas (npm run test:planner)
  postbuild-web.mjs          PWA (manifest, 404) / --standalone / --artifact (archivo único)
  serve-web.mjs              Servidor estático de dist/ en 0.0.0.0:8080
.github/workflows/pages.yml  Typecheck + test + build + deploy a GitHub Pages (push a main)
```

## Modelos (`src/lib/types.ts`)
- `Garment` { id, imageUri, category: top|tercera|inferior|calzado|accesorio, subtype, name, color, colorHex, texture, warmth 1-5, formality 1-5, rainSafe, aiTagged, needsReview? }
- `Look` { topId, thirdId, bottomId, shoesId, accessoryId?, rationale }
- `DayPlan` { dayIndex 0-4, date, look|null, locked, note, source?, error?, warnings? } · `WeekPlan` { weekStart, days[5] }
- `HistoryEntry` { id, date, look, signature, savedAt }
- `Settings` { model (def. gemini-4-argon), useGeminiPlanner, weekOffset 0|1 }
- `UserProfile` { name, age, profession, style, heightCm, weightKg, bodyType, bust/waist/hipCm?, skinTone, undertone, completedAt }
- Perfil: opciones en `STYLE_OPTIONS`, `BODY_TYPES`, `SKIN_SEASONS`, `UNDERTONES`; `EMPTY_PROFILE` como valor inicial.
- Claves kv: `capsula.items.v1`, `capsula.week.v1`, `capsula.history.v1`, `capsula.settings.v1`, `capsula.profile.v1`

## Flujos
- Arranque: `_layout` carga store → si no hay `profile` → `Welcome` (bienvenida → pasos de perfil) → Tabs.
- Carga simple: + → cámara/fototeca → `processAndStorePhoto` → `tagGarment(profile)` → `GarmentEditor` → guardar.
- Carga masiva: + → "Varias fotos" → cola secuencial (comprimir → etiquetar) → se agregan directo; las que fallan quedan `needsReview`.
- Semana: `generateWeek` (días sin candado, en orden, exclusión acumulada) · `regenerateDay(i)` (exclusión = otros 4 días).
- Gemini recibe `profileContext(profile)` en etiquetado y en armado de looks.

## Estado por fases
- [x] Fase 0: app base (3 pestañas, clóset con IA, planificador con reglas, historial, PWA, Artifact, Pages)
- [x] Memoria: CLAUDE.md + PROJECT_MAP.md
- [x] Módulo 1: bienvenida (eslogan) + onboarding en 2 pasos + perfil biométrico editable en Ajustes + contexto en Gemini
- [x] Módulo 2 (parcial): carga masiva (hasta 20 fotos, cola secuencial, badge "Por revisar")
- [ ] Módulo 2 (resto) y módulos siguientes: pendientes de especificación (el mensaje del dueño llegó truncado)
- [x] Prueba real con API Key (16-oct-2026): gemini-3.5-flash etiqueta y arma looks válidos; gemini-4-argon sin cuota en plan gratuito
- [ ] Pendiente técnico: el motor local aún no usa el perfil (solo Gemini lo recibe)
