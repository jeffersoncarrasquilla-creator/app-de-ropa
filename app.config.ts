import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extiende app.json. EXPO_BASE_URL permite publicar la PWA en un subdirectorio (p. ej. GitHub Pages: /app-de-ropa).
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : null),
  },
});
