# My Closet

App para iPhone (React Native + Expo SDK 57 + TypeScript + Expo Router, con versión web/PWA) para gestionar un armario cápsula ejecutivo y planear looks de lunes a viernes para el clima de Bogotá (9 °C a 19 °C, lluvia frecuente, oficina cerrada).

## Funciones

| Pestaña | Qué hace |
| --- | --- |
| **Bienvenida y perfil** | Primera apertura: pantalla con el eslogan *"My Closet, tu asesor de moda, siempre"* y onboarding en 2 pasos (nombre, edad, profesión, estilo; altura, peso, tipo de cuerpo, medidas, colorimetría y subtono). Editable en Ajustes. Estos datos se inyectan en los prompts de Gemini. |
| **Mi Clóset** | Botón **+** → cámara o fototeca (`expo-image-picker`). La foto se convierte de HEIC a JPEG, se redimensiona y comprime (`expo-image-manipulator`) y se guarda en el teléfono (`expo-file-system`; IndexedDB en web). Antes de cargar se advierte: una sola prenda por foto. Gemini la etiqueta en JSON: categoría (incluye vestidos), estilos, color, textura, abrigo térmico 1‑5, formalidad ejecutiva 1‑5 y apto para lluvia. Las etiquetas se pueden corregir a mano. **Carga masiva**: hasta 20 fotos de la fototeca a la vez; cada una se comprime y etiqueta en cola y las que fallan quedan *Por revisar*. |
| **Semana** | Genera 5 looks por capas (blusa + tercera pieza + pantalón/falda + calzado + bolso opcional) con el pronóstico de Open‑Meteo para Bogotá (o climatología 9–19 °C si no hay red). Cada tarjeta tiene **candado** y **Regenerar solo este día** con nota rápida. |
| **Historial/Ajustes** | Looks confirmados (no se vuelven a proponer). API Key de Gemini en `expo-secure-store` (llavero iOS) y modelo configurable (por defecto `gemini-3.5-flash`; `gemini-4-argon` requiere facturación activa). |

### Reglas del planificador (`src/lib/planner.ts`)

1. Las prendas pueden repetirse durante la semana (se favorece la variedad).
2. Las **combinaciones** no se repiten, ni en la semana ni frente al Historial, salvo que la usuaria active *Permitir repetir un look* o lo pida en la nota.
3. Un look es un vestido, o blusa + pantalón/falda; calzado obligatorio; tercera pieza obligatoria en estilo Ejecutivo y sugerida según el clima.
4. Estilo del día: Ejecutivo, Casual, Elegante, Deportivo, Playa o Fiesta; el mismo toda la semana o uno distinto por día.
5. **La IA prevalece**: si hay API Key, Gemini arma el look y solo se descarta si rompe una regla dura; el motor local es el respaldo.

### Probador virtual
"Ver cómo me queda" genera con Gemini una foto realista de la usuaria (con su foto de cuerpo entero, si la agregó en el perfil) o de una modelo con su fisonomía, vistiendo las prendas del look. Requiere un modelo de imagen con cuota (`gemini-3.1-flash-image` por defecto): en el plan gratuito suele no haber cuota y hay que activar la facturación en Google AI Studio.

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
