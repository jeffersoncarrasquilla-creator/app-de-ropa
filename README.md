# My Closet

App para iPhone (React Native + Expo SDK 57 + TypeScript + Expo Router, con versión web/PWA) para gestionar un armario cápsula ejecutivo y planear looks de lunes a viernes para el clima de Bogotá (9 °C a 19 °C, lluvia frecuente, oficina cerrada).

## Funciones

| Pestaña | Qué hace |
| --- | --- |
| **Bienvenida y perfil** | Primera apertura: pantalla con el eslogan *"My Closet, tu asesor de moda, siempre"* y onboarding en 2 pasos (nombre, edad, profesión, estilo; altura, peso, tipo de cuerpo, medidas, colorimetría y subtono). Editable en Ajustes. Estos datos se inyectan en los prompts de Gemini. |
| **Mi Clóset** | Botón **+** → cámara o fototeca (`expo-image-picker`). La foto se convierte de HEIC a JPEG, se redimensiona y comprime (`expo-image-manipulator`) y se guarda en el teléfono (`expo-file-system`; IndexedDB en web). Gemini la etiqueta en JSON: categoría, color, textura, abrigo térmico 1‑5, formalidad ejecutiva 1‑5 y apto para lluvia. Las etiquetas se pueden corregir a mano. **Carga masiva**: hasta 20 fotos de la fototeca a la vez; cada una se comprime y etiqueta en cola y las que fallan quedan *Por revisar*. |
| **Semana** | Genera 5 looks por capas (blusa + tercera pieza + pantalón/falda + calzado + bolso opcional) con el pronóstico de Open‑Meteo para Bogotá (o climatología 9–19 °C si no hay red). Cada tarjeta tiene **candado** y **Regenerar solo este día** con nota rápida. |
| **Historial/Ajustes** | Looks confirmados (no se vuelven a proponer). API Key de Gemini en `expo-secure-store` (llavero iOS) y modelo configurable (por defecto `gemini-4-argon`). |

### Reglas estrictas del planificador (`src/lib/planner.ts`)

1. Prohibido repetir looks completos del Historial (firma = blusa + tercera pieza + inferior + calzado).
2. Prohibido repetir prendas principales (blusa, tercera pieza, pantalón/falda) en la misma semana.
3. Al regenerar un día, las prendas de los otros 4 días se envían como **lista de exclusión obligatoria** y solo se recalcula ese día. El calzado solo se repite si no queda ninguna alternativa (se advierte); el bolso nunca se repite (se omite).
4. Formalidad ejecutiva promedio ≥ 3, abrigo suficiente según la mínima del día, prioridad a calzado impermeable si llueve, y blusa presentable sola para la oficina cerrada.

Si Gemini está activo, su propuesta se valida con estas mismas reglas; si las incumple o falla, se usa el motor local.

## Ejecutar

```bash
npm install
npx tsc --noEmit          # verificación de tipos
npm run test:planner      # prueba de las reglas del planificador
```

### Abrir en el iPhone

- **Expo Go con túnel** (desde un computador, el QR o el enlace `exp://` sirven aunque el iPhone esté en otra red):
  ```bash
  npm run start:tunnel     # = npx expo start --tunnel
  ```
  En la terminal pulsa `s` para cambiar a Expo Go si aparece "development build". Para abrir con un toque desde el propio iPhone, envíate por mensaje el enlace `exp://…exp.direct` que imprime la terminal.
- **PWA en la misma Wi‑Fi**: `npm run build:web && npm run serve:web` y abre en Safari la URL `http://<IP>:8080` que se imprime. Compartir → *Agregar a pantalla de inicio*.
- **PWA pública (GitHub Pages)**: en GitHub → *Settings → Pages → Source: GitHub Actions*. Cada push a `main` publica la app en `https://<usuario>.github.io/app-de-ropa/`.
- **Archivo único**: `npm run build:standalone` genera `dist-standalone/index.html` con todo embebido.

## Notas

- En web/PWA no existe llavero: la API Key se guarda solo en el navegador del dispositivo (IndexedDB).
- Datos 100 % locales; solo la foto se envía a Gemini para etiquetarla y el inventario (sin fotos) para armar looks.
- Para planear la semana se necesitan, como mínimo, 5 blusas, 5 terceras piezas, 5 pantalones/faldas y 1‑2 pares de zapatos.
