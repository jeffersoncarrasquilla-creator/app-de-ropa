import { Redirect } from 'expo-router';

/** Cualquier ruta desconocida (p. ej. al abrir la PWA desde un subdirectorio) vuelve a Mi Clóset. */
export default function NotFound() {
  return <Redirect href="/" />;
}
