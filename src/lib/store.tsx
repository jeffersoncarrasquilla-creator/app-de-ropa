import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DAY_NAMES, DEFAULT_SETTINGS } from './types';
import type { DayPlan, DayWeather, Garment, HistoryEntry, Look, OutfitStyle, Settings, UserProfile, WeekPlan } from './types';
import { CATEGORY_LABEL, OUTFIT_STYLES } from './types';
import { kvDelete, kvGetJson, kvSetJson } from './kv';
import { getApiKey, setApiKey as persistApiKey } from './secrets';
import { mondayFor, weekDates } from './dates';
import { bogotaClimatology, fetchBogotaWeather } from './weather';
import { lookItemIds, lookSignature, parseNote, planDay, validateLook } from './planner';
import type { PlanContext } from './planner';
import { generateTryOn, suggestLookWithGemini } from './gemini';
import { deleteStoredPhoto, readImageBase64, saveGeneratedImage } from './images';

const K = {
  items: 'capsula.items.v1',
  week: 'capsula.week.v1',
  history: 'capsula.history.v1',
  settings: 'capsula.settings.v1',
  profile: 'capsula.profile.v1',
};

function emptyWeek(monday: string): WeekPlan {
  return {
    weekStart: monday,
    days: weekDates(monday).map((date, dayIndex) => ({ dayIndex, date, look: null, locked: false, note: '' })),
  };
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface StoreValue {
  ready: boolean;
  items: Garment[];
  week: WeekPlan;
  weather: DayWeather[];
  history: HistoryEntry[];
  settings: Settings;
  apiKey: string;
  /** null = primera vez: se muestra la bienvenida y el onboarding. */
  profile: UserProfile | null;
  saveProfile: (p: UserProfile) => void;
  busyDays: number[];
  tryOnBusy: number[];
  itemById: Map<string, Garment>;
  addGarment: (g: Garment) => void;
  updateGarment: (g: Garment) => void;
  deleteGarment: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveApiKey: (key: string) => Promise<void>;
  setNote: (dayIndex: number, note: string) => void;
  toggleLock: (dayIndex: number) => void;
  toggleRepeat: (dayIndex: number) => void;
  setDayStyle: (dayIndex: number, style: OutfitStyle) => void;
  styleFor: (day: DayPlan) => OutfitStyle;
  generateTryOnForDay: (dayIndex: number) => Promise<string | null>;
  generateWeek: () => Promise<void>;
  regenerateDay: (dayIndex: number) => Promise<void>;
  saveWeekToHistory: () => number;
  deleteHistory: (id: string) => void;
  clearAll: () => Promise<void>;
  refreshWeather: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore debe usarse dentro de <StoreProvider>.');
  return v;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Garment[]>([]);
  const [week, setWeek] = useState<WeekPlan>(() => emptyWeek(mondayFor(new Date(), 0)));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKeyState] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weather, setWeather] = useState<DayWeather[]>(() => week.days.map((d) => bogotaClimatology(d.date)));
  const [busyDays, setBusyDays] = useState<number[]>([]);
  const [tryOnBusy, setTryOnBusy] = useState<number[]>([]);

  // Referencias al estado más reciente para las operaciones asíncronas.
  const ref = useRef({ items, week, history, settings, apiKey, weather, profile });
  ref.current = { items, week, history, settings, apiKey, weather, profile };

  // Carga inicial desde el almacenamiento local del teléfono.
  useEffect(() => {
    (async () => {
      const [i, w, h, s, key, prof] = await Promise.all([
        kvGetJson<Garment[]>(K.items, []),
        kvGetJson<WeekPlan | null>(K.week, null),
        kvGetJson<HistoryEntry[]>(K.history, []),
        kvGetJson<Settings>(K.settings, DEFAULT_SETTINGS),
        getApiKey().catch(() => ''),
        kvGetJson<UserProfile | null>(K.profile, null),
      ]);
      const merged = { ...DEFAULT_SETTINGS, ...s };
      // Migración: el predeterminado anterior (gemini-4-argon) no tiene cuota en el plan gratuito.
      if (merged.model === 'gemini-4-argon') merged.model = DEFAULT_SETTINGS.model;
      const monday = mondayFor(new Date(), merged.weekOffset);
      setItems(i);
      setHistory(h);
      setSettings(merged);
      setApiKeyState(key);
      setProfile(prof);
      setWeek(w && w.weekStart === monday ? w : emptyWeek(monday));
      setReady(true);
    })();
  }, []);

  // Persistencia automática.
  useEffect(() => {
    if (ready) void kvSetJson(K.items, items);
  }, [items, ready]);
  useEffect(() => {
    if (ready) void kvSetJson(K.week, week);
  }, [week, ready]);
  useEffect(() => {
    if (ready) void kvSetJson(K.history, history);
  }, [history, ready]);
  useEffect(() => {
    if (ready) void kvSetJson(K.settings, settings);
  }, [settings, ready]);

  // Cambio de semana (esta / próxima).
  useEffect(() => {
    if (!ready) return;
    const monday = mondayFor(new Date(), settings.weekOffset);
    setWeek((w) => (w.weekStart === monday ? w : emptyWeek(monday)));
  }, [settings.weekOffset, ready]);

  const refreshWeather = useCallback(async () => {
    const dates = ref.current.week.days.map((d) => d.date);
    setWeather(dates.map(bogotaClimatology));
    const w = await fetchBogotaWeather(dates);
    setWeather(w);
  }, []);

  useEffect(() => {
    if (ready) void refreshWeather();
  }, [week.weekStart, ready, refreshWeather]);

  const itemById = useMemo(() => new Map(items.map((g) => [g.id, g])), [items]);

  const addGarment = useCallback((g: Garment) => setItems((xs) => [g, ...xs]), []);
  const updateGarment = useCallback((g: Garment) => setItems((xs) => xs.map((x) => (x.id === g.id ? g : x))), []);

  const deleteGarment = useCallback((id: string) => {
    const g = ref.current.items.find((x) => x.id === id);
    if (g) deleteStoredPhoto(g.imageUri);
    setItems((xs) => xs.filter((x) => x.id !== id));
    // Un look que usaba la prenda eliminada deja de ser válido.
    setWeek((w) => ({
      ...w,
      days: w.days.map((d) =>
        lookItemIds(d.look).includes(id)
          ? { ...d, look: null, locked: false, warnings: [], error: 'Se eliminó una prenda de este look. Regenera el día.' }
          : d,
      ),
    }));
  }, []);

  const saveProfile = useCallback((p: UserProfile) => {
    const next = { ...p, completedAt: p.completedAt ?? new Date().toISOString() };
    setProfile(next);
    void kvSetJson(K.profile, next);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const saveApiKey = useCallback(async (key: string) => {
    await persistApiKey(key);
    setApiKeyState(key.trim());
  }, []);

  const patchDay = useCallback((dayIndex: number, patch: Partial<DayPlan>) => {
    setWeek((w) => ({ ...w, days: w.days.map((d) => (d.dayIndex === dayIndex ? { ...d, ...patch } : d)) }));
  }, []);

  const setNote = useCallback((dayIndex: number, note: string) => patchDay(dayIndex, { note }), [patchDay]);

  const toggleLock = useCallback(
    (dayIndex: number) => {
      const d = ref.current.week.days[dayIndex];
      if (!d?.look) return;
      patchDay(dayIndex, { locked: !d.locked });
    },
    [patchDay],
  );

  /** Estilo efectivo de un día: el de la semana, o el elegido para ese día en modo "por día". */
  const styleFor = useCallback((day: DayPlan): OutfitStyle => {
    const st = ref.current.settings;
    return st.styleMode === 'perDay' ? day.style ?? st.weekStyle : st.weekStyle;
  }, []);

  /**
   * Calcula el look de un día. Las combinaciones de los demás días y del Historial quedan prohibidas
   * (salvo que la usuaria permita repetir); las prendas pueden repetirse. La IA tiene prioridad.
   */
  const computeDay = useCallback(
    async (dayIndex: number, days: DayPlan[], avoidCurrent: boolean): Promise<Partial<DayPlan>> => {
      const { items: inv, history: hist, settings: st, apiKey: key, weather: wx, profile: prof } = ref.current;
      const day = days[dayIndex];
      const repeatAllowed = !!day.allowRepeat || parseNote(day.note).wantRepeat;
      const forbidden = new Set<string>();
      const usedElsewhere = new Set<string>();
      for (const other of days) {
        if (other.dayIndex === dayIndex || !other.look) continue;
        lookItemIds(other.look).forEach((id) => usedElsewhere.add(id));
        if (!repeatAllowed) forbidden.add(lookSignature(other.look));
      }
      if (!repeatAllowed) hist.forEach((h) => forbidden.add(h.signature));
      if (avoidCurrent && day.look) forbidden.add(lookSignature(day.look));
      const ctx: PlanContext = {
        items: inv,
        weather: wx[dayIndex] ?? bogotaClimatology(day.date),
        style: styleFor(day),
        forbiddenSignatures: forbidden,
        usedElsewhere,
        note: day.note,
      };
      const cleared = { tryOnUri: undefined, error: undefined };
      if (day.tryOnUri) deleteStoredPhoto(day.tryOnUri);

      const warnings: string[] = [];
      if (st.useGeminiPlanner && key) {
        try {
          const proposal = await suggestLookWithGemini(key, st.model, ctx, DAY_NAMES[dayIndex], prof);
          if (proposal.accessoryId && !inv.some((g) => g.id === proposal.accessoryId)) proposal.accessoryId = undefined;
          if (proposal.thirdId && !inv.some((g) => g.id === proposal.thirdId)) proposal.thirdId = undefined;
          // La propuesta de la IA prevalece: solo se descarta si rompe una regla dura.
          const violations = validateLook(proposal, ctx, 'ai');
          if (!violations.length) return { ...cleared, look: proposal, source: 'gemini', warnings: [] };
          warnings.push(`La IA propuso un look no válido (${violations[0]}). Se usó el motor local como respaldo.`);
        } catch (e) {
          warnings.push(`${(e as Error).message} Se usó el motor local como respaldo.`);
        }
      } else if (!key) {
        warnings.push('Sin API Key de Gemini: look armado por el motor local. Configúrala en Ajustes para recomendaciones con IA.');
      }
      const res = planDay(ctx);
      if (!res.ok) return { ...cleared, look: null, locked: false, error: res.error, warnings, source: undefined };
      return { ...cleared, look: res.look, source: 'local', warnings: [...warnings, ...res.warnings] };
    },
    [styleFor],
  );

  const setDayStyle = useCallback((dayIndex: number, style: OutfitStyle) => patchDay(dayIndex, { style }), [patchDay]);

  const toggleRepeat = useCallback(
    (dayIndex: number) => {
      const d = ref.current.week.days[dayIndex];
      if (d) patchDay(dayIndex, { allowRepeat: !d.allowRepeat });
    },
    [patchDay],
  );

  /** Probador virtual: genera una imagen de la usuaria vistiendo el look del día. Devuelve un error legible o null. */
  const generateTryOnForDay = useCallback(
    async (dayIndex: number): Promise<string | null> => {
      const { week: w, items: inv, apiKey: key, settings: st, profile: prof } = ref.current;
      const day = w.days[dayIndex];
      if (!day?.look) return 'Primero genera el look de este día.';
      if (!key) return 'Configura tu API Key de Gemini en Ajustes para usar el probador virtual.';
      setTryOnBusy((b) => [...b, dayIndex]);
      try {
        const map = new Map(inv.map((g) => [g.id, g]));
        const garments = [];
        for (const id of lookItemIds(day.look)) {
          const g = map.get(id);
          if (g) garments.push({ label: `${CATEGORY_LABEL[g.category]}: ${g.name} (${g.color})`, base64: await readImageBase64(g.imageUri) });
        }
        const body = prof?.bodyPhotoUri ? await readImageBase64(prof.bodyPhotoUri).catch(() => null) : null;
        const img = await generateTryOn(key, st.imageModel, garments, prof, body, OUTFIT_STYLES[styleFor(day)].label);
        if (day.tryOnUri) deleteStoredPhoto(day.tryOnUri);
        const uri = saveGeneratedImage(img.base64, img.mimeType, `${day.date}-${Date.now()}`);
        patchDay(dayIndex, { tryOnUri: uri });
        return null;
      } catch (e) {
        return (e as Error).message;
      } finally {
        setTryOnBusy((b) => b.filter((x) => x !== dayIndex));
      }
    },
    [patchDay, styleFor],
  );

  const generateWeek = useCallback(async () => {
    const base = ref.current.week;
    // Los días no bloqueados se vacían para recalcularlos; los bloqueados quedan intactos.
    let days: DayPlan[] = base.days.map((d) => (d.locked ? d : { ...d, look: null, error: undefined, warnings: [] }));
    const targets = days.filter((d) => !d.locked).map((d) => d.dayIndex);
    setBusyDays(targets);
    setWeek({ ...base, days });
    for (const i of targets) {
      const patch = await computeDay(i, days, false);
      days = days.map((d) => (d.dayIndex === i ? { ...d, ...patch } : d));
      setWeek((w) => ({ ...w, days: w.days.map((d) => (d.dayIndex === i ? { ...d, ...patch } : d)), generatedAt: new Date().toISOString() }));
      setBusyDays((b) => b.filter((x) => x !== i));
    }
    setBusyDays([]);
  }, [computeDay]);

  /** Regenera ÚNICAMENTE el día indicado; los otros 4 días no se modifican. */
  const regenerateDay = useCallback(
    async (dayIndex: number) => {
      const days = ref.current.week.days;
      if (days[dayIndex]?.locked) return;
      setBusyDays((b) => [...b, dayIndex]);
      try {
        const patch = await computeDay(dayIndex, days, true);
        patchDay(dayIndex, patch);
      } finally {
        setBusyDays((b) => b.filter((x) => x !== dayIndex));
      }
    },
    [computeDay, patchDay],
  );

  const saveWeekToHistory = useCallback(() => {
    const { week: w, history: h } = ref.current;
    const existing = new Set(h.map((e) => `${e.date}|${e.signature}`));
    const entries: HistoryEntry[] = [];
    for (const d of w.days) {
      if (!d.look) continue;
      const signature = lookSignature(d.look);
      if (existing.has(`${d.date}|${signature}`)) continue;
      entries.push({ id: newId(), date: d.date, look: d.look as Look, signature, savedAt: new Date().toISOString() });
    }
    if (entries.length) setHistory((xs) => [...entries, ...xs].sort((a, b) => b.date.localeCompare(a.date)));
    return entries.length;
  }, []);

  const deleteHistory = useCallback((id: string) => setHistory((xs) => xs.filter((x) => x.id !== id)), []);

  const clearAll = useCallback(async () => {
    ref.current.items.forEach((g) => deleteStoredPhoto(g.imageUri));
    // El perfil y la API Key se conservan.
    await Promise.all([K.items, K.week, K.history, K.settings].map(kvDelete));
    setItems([]);
    setHistory([]);
    setWeek(emptyWeek(mondayFor(new Date(), ref.current.settings.weekOffset)));
  }, []);

  const value: StoreValue = {
    ready,
    items,
    week,
    weather,
    history,
    settings,
    apiKey,
    profile,
    saveProfile,
    busyDays,
    tryOnBusy,
    itemById,
    addGarment,
    updateGarment,
    deleteGarment,
    updateSettings,
    saveApiKey,
    setNote,
    toggleLock,
    toggleRepeat,
    setDayStyle,
    styleFor,
    generateTryOnForDay,
    generateWeek,
    regenerateDay,
    saveWeekToHistory,
    deleteHistory,
    clearAll,
    refreshWeather,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
