# My Closet: memoria del proyecto

## Regla obligatoria de navegación
**Antes de explorar el repositorio o buscar archivos, lee siempre `PROJECT_MAP.md`** para ubicar exactamente qué archivos modificar sin escanear todo el proyecto.
**Al finalizar cualquier cambio de código, actualiza `PROJECT_MAP.md`** con los archivos, modelos, flujos o estados nuevos o modificados.

## Contexto
- App iPhone en **React Native + Expo SDK 57 + TypeScript + Expo Router** (también web/PWA). No migrar a Swift nativo: decisión del dueño.
- El diseño visual (marfil, taupe, negro carbón; serif Georgia para títulos; tokens en `src/lib/theme.ts`) fue **validado con usuarias reales: no alterarlo**. Las pantallas nuevas reutilizan `theme.ts` y los componentes de `src/components/ui.tsx`.
- Idioma de la UI y del código de dominio: español (Colombia).
- Ver también `AGENTS.md` (convenciones Expo: `npx expo install`, rutas en `src/app/`).

## Verificación antes de entregar
```bash
npx tsc --noEmit
npm run test:planner
EXPO_OFFLINE=1 CI=1 npm run build:artifact   # build web; sirve para probar con Playwright
```
- Los docs de Expo y la API de versiones están bloqueados por el proxy de este entorno: usar `EXPO_OFFLINE=1` y leer los `.d.ts` en `node_modules`.
- Chromium para pruebas E2E: `executablePath: '/opt/pw-browsers/chromium'` con `playwright-core`.

## Reglas de negocio que no se deben romper
- `src/lib/planner.ts` es la fuente de verdad: no repetir looks completos del Historial ni prendas principales en la semana; al regenerar un día, las prendas de los otros 4 días son exclusión obligatoria. Toda propuesta de Gemini se valida con `validateLook`.
- La API Key de Gemini solo vive en SecureStore (`src/lib/secrets.ts`).
