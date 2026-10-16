// Completa la build web (dist/) como PWA instalable en iPhone y, con --standalone,
// genera dist-standalone/index.html: un único archivo autocontenido (JS + íconos embebidos).
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const artifact = process.argv.includes('--artifact');
const standalone = artifact || process.argv.includes('--standalone');

const head = `
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="My Closet" />
    <meta name="description" content="Armario cápsula ejecutivo y planificador semanal para el clima de Bogotá." />
    <style>html,body{background:#F6F1E9}</style>`;

let html = await readFile(join(dist, 'index.html'), 'utf8');
html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace(/<meta name="viewport"[^>]*>/, '')
  .replace('</head>', `${head}\n${standalone ? '' : `<link rel="manifest" href="${base}/manifest.json" /><link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />`}</head>`);

if (!standalone) {
  await writeFile(join(dist, 'index.html'), html);
  await writeFile(join(dist, '404.html'), html); // GitHub Pages: rutas profundas sirven la app
  await copyFile('assets/icon.png', join(dist, 'apple-touch-icon.png'));
  await writeFile(
    join(dist, 'manifest.json'),
    JSON.stringify(
      {
        name: 'My Closet',
        short_name: 'My Closet',
        start_url: `${base}/`,
        scope: `${base}/`,
        display: 'standalone',
        background_color: '#F6F1E9',
        theme_color: '#F6F1E9',
        lang: 'es-CO',
        icons: [{ src: `${base}/apple-touch-icon.png`, sizes: '1024x1024', type: 'image/png' }],
      },
      null,
      2,
    ),
  );
  console.log('PWA lista en dist/');
} else {
  const m = html.match(/<script src="([^"]+)" defer><\/script>/);
  if (!m) throw new Error('No se encontró el bundle JS en index.html');
  let js = await readFile(join(dist, m[1].replace(base, '')), 'utf8');
  // Embebe la fuente de Ionicons (única familia de íconos usada).
  const fontDir = join(dist, 'assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');
  const ion = (await readdir(fontDir)).find((f) => f.startsWith('Ionicons.') && f.endsWith('.ttf'));
  if (ion) {
    const data = (await readFile(join(fontDir, ion))).toString('base64');
    js = js.split(`${base}/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${ion}`).join(`data:font/ttf;base64,${data}`);
  }
  js = js.replace(/<\/script/gi, '<\\/script');
  // El enrutador arranca siempre en "/" aunque la página se sirva desde otra ruta.
  const boot = `<script>try{history.replaceState(null,'','/')}catch(e){}</script>`;
  html = html.replace(m[0], () => `${boot}<script>${js}</script>`).replace(/<link rel="icon"[^>]*>/, '');
  await mkdir('dist-standalone', { recursive: true });
  await writeFile('dist-standalone/index.html', html);
  console.log(`dist-standalone/index.html (${(html.length / 1048576).toFixed(1)} MB)`);
  if (artifact) {
    // Fragmento para hosts que ya aportan <html>/<head>/<body> (p. ej. Artifacts de claude.ai).
    const reset = html.match(/<style id="expo-reset">[\s\S]*?<\/style>/)?.[0] ?? '';
    const fragment = [
      '<title>My Closet</title>',
      '<meta name="theme-color" content="#F6F1E9">',
      reset,
      '<style>html,body{background:#F6F1E9;color:#2B2A28}</style>',
      '<div id="root"></div>',
      `${boot}<script>${js}</script>`,
    ].join('\n');
    await writeFile('dist-standalone/artifact.html', fragment);
    console.log('dist-standalone/artifact.html');
  }
}
