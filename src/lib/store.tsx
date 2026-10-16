import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DAY_NAMES, DEFAULT_SETTINGS } from './types';
import type { DayPlan, DayWeather, Garment, HistoryEntry, Look, Settings, UserProfile, WeekPlan } from './types';
import { kvDelete, kvGetJson, kvSetJson } from './kv';
import { getApiKey, setApiKey as persistApiKey } from './secrets';
import { mondayFor, weekDates } from './dates';
import { bogotaClimatology, fetchBogotaWeather } from './weather';
import { lookItemIds, lookSignature, planDay, validateLook } from './planner';
import type { PlanContext } from './planner';
import { suggestLookWithGemini } from './gemini';
import { deleteStoredPhoto } from './images';

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
  itemById: Map<string, Garment>;
  addGarment: (g: Garment) => void;
  updateGarment: (g: Garment) => void;
  deleteGarment: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveApiKey: (key: string) => Promise<void>;
  setNote: (dayIndex: number, note: string) => void;
  toggleLock: (dayIndex: number) => void;
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

  /**
   * Calcula el look de un día. `days` es el estado de la semana a usar como contexto:
   * las prendas de TODOS los demás días se envían como lista de exclusión obligatoria.
   */
  const computeDay = useCallback(
    async (dayIndex: number, days: DayPlan[], avoidCurrent: boolean): Promise<Partial<DayPlan>> => {
      const { items: inv, history: hist, settings: st, apiKey: key, weather: wx, profile: prof } = ref.current;
      const day = days[dayIndex];
      const exclude = new Set<string>();
      for (const other of days) if (other.dayIndex !== dayIndex) lookItemIds(other.look).forEach((id) => exclude.add(id));
      const avoid = new Set<string>();
      if (avoidCurrent && day.look) avoid.add(lookSignature(day.look));
      const ctx: PlanContext = {
        items: inv,
        weather: wx[dayIndex] ?? bogotaClimatology(day.date),
        exclude,
        historySignatures: new Set(hist.map((h) => h.signature)),
        avoidSignatures: avoid,
        note: day.note,
      };

      const warnings: string[] = [];
      if (st.useGeminiPlanner && key) {
        try {
          const proposal = await suggestLookWithGemini(key, st.model, ctx, DAY_NAMES[dayIndex], prof);
          if (proposal.accessoryId && !inv.some((g) => g.id === proposal.accessoryId)) proposal.accessoryId = undefined;
          const violations = validateLook(proposal, ctx, false);
          if (!violations.length) {
            return { look: proposal, source: 'gemini', error: undefined, warnings: [] };
          }
          warnings.push(`Gemini propuso un look que incumplía las reglas (${violations[0]}). Se recalculó con el motor local.`);
        } catch (e) {
          warnings.push(`${(e as Error).message} Se usó el motor local.`);
        }
      }
      const res = planDay(ctx);
      if (!res.ok) return { look: null, locked: false, error: res.error, warnings, source: undefined };
      return { look: res.look, source: 'local', error: undefined, warnings: [...warnings, ...res.warnings] };
    },
    [],
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
    itemById,
    addGarment,
    updateGarment,
    deleteGarment,
    updateSettings,
    saveApiKey,
    setNote,
    toggleLock,
    generateWeek,
    regenerateDay,
    saveWeekToHistory,
    deleteHistory,
    clearAll,
    refreshWeather,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
