import type { DayWeather } from './types';

const BOGOTA = { lat: 4.711, lon: -74.0721 };

/** Clima típico de Bogotá cuando no hay pronóstico disponible (9 °C a 19 °C, lluvia frecuente). */
export function bogotaClimatology(date: string): DayWeather {
  return { date, min: 9, max: 19, rainProb: 60, estimated: true };
}

/**
 * Pronóstico diario de Open-Meteo (gratuito, sin API Key). Si falla o la fecha
 * está fuera de rango, se usa la climatología de Bogotá.
 */
export async function fetchBogotaWeather(dates: string[]): Promise<DayWeather[]> {
  const fallback = dates.map(bogotaClimatology);
  if (!dates.length) return fallback;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${BOGOTA.lat}&longitude=${BOGOTA.lon}` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=America%2FBogota&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_probability_max: (number | null)[];
      };
    };
    const daily = json.daily;
    if (!daily) return fallback;
    return dates.map((date) => {
      const i = daily.time.indexOf(date);
      const max = i >= 0 ? daily.temperature_2m_max[i] : null;
      const min = i >= 0 ? daily.temperature_2m_min[i] : null;
      if (i < 0 || max == null || min == null) return bogotaClimatology(date);
      return {
        date,
        min: Math.round(min),
        max: Math.round(max),
        rainProb: daily.precipitation_probability_max[i] ?? 60,
        estimated: false,
      };
    });
  } catch {
    return fallback;
  }
}
