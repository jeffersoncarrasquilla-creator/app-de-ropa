import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { colors, fonts, radius, space } from '../lib/theme';
import { shortDate } from '../lib/dates';
import type { OutfitStyle } from '../lib/types';
import { OUTFIT_STYLE_ORDER, OUTFIT_STYLES } from '../lib/types';
import { Button, Chip, ScreenHeader, Sheet, notify } from '../components/ui';
import { DayCard } from '../components/DayCard';

export default function WeekScreen() {
  const {
    week,
    weather,
    itemById,
    busyDays,
    tryOnBusy,
    items,
    apiKey,
    settings,
    updateSettings,
    generateWeek,
    regenerateDay,
    toggleLock,
    toggleRepeat,
    setDayStyle,
    styleFor,
    generateTryOnForDay,
    setNote,
    saveWeekToHistory,
  } = useStore();
  const [styleSheet, setStyleSheet] = useState(false);
  const [pendingGenerate, setPendingGenerate] = useState(false);
  const [draftMode, setDraftMode] = useState<'same' | 'perDay'>(settings.styleMode ?? 'same');
  const [draftStyle, setDraftStyle] = useState<OutfitStyle>(settings.weekStyle);

  const generating = busyDays.length > 0;
  const planned = week.days.filter((d) => d.look).length;
  const lockedCount = week.days.filter((d) => d.locked).length;
  const first = week.days[0]?.date;
  const last = week.days[4]?.date;
  const engine = settings.useGeminiPlanner && apiKey ? `IA (${settings.model}) con prioridad · motor local de respaldo` : 'Motor de reglas local (sin API Key)';
  const styleSummary =
    settings.styleMode === 'perDay'
      ? `Estilo por día: ${week.days.map((d) => OUTFIT_STYLES[styleFor(d)].label).join(' · ')}`
      : `Estilo de la semana: ${OUTFIT_STYLES[settings.weekStyle].label}`;

  function openStyleSheet(thenGenerate: boolean) {
    setDraftMode(settings.styleMode ?? 'same');
    setDraftStyle(settings.weekStyle);
    setPendingGenerate(thenGenerate);
    setStyleSheet(true);
  }

  function confirmStyle() {
    updateSettings({ styleMode: draftMode, weekStyle: draftStyle });
    // En modo por día, los días sin estilo propio arrancan con el estilo base elegido.
    if (draftMode === 'perDay') week.days.forEach((d) => !d.style && setDayStyle(d.dayIndex, draftStyle));
    setStyleSheet(false);
    if (pendingGenerate && draftMode === 'same') setTimeout(() => void generateWeek(), 60);
    if (pendingGenerate && draftMode === 'perDay') {
      notify('Elige el estilo de cada día', 'En cada tarjeta toca el estilo que quieres (Ejecutivo, Casual, Playa…) y luego pulsa "Generar semana".');
    }
  }

  function handleGenerate() {
    // La primera vez se le pregunta a la usuaria si quiere el mismo estilo todos los días.
    if (settings.styleMode === null) openStyleSheet(true);
    else void generateWeek();
  }

  async function handleTryOn(dayIndex: number) {
    const err = await generateTryOnForDay(dayIndex);
    if (err) notify('No se pudo crear la imagen', err);
  }

  function handleSave() {
    const n = saveWeekToHistory();
    notify(
      n ? 'Semana guardada' : 'Nada nuevo que guardar',
      n
        ? `${n} look(s) agregados al Historial. Esas combinaciones no se volverán a proponer (salvo que pidas repetirlas).`
        : 'Los looks de esta semana ya estaban en el Historial o aún no hay looks.',
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker={first && last ? `${shortDate(first)} – ${shortDate(last)} · Bogotá` : 'Bogotá'} title="Semana" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {planned}/5 looks · {lockedCount} con candado · {items.length} prendas
            </Text>
            <Text style={styles.summarySub}>{engine}. Las prendas pueden repetirse; las combinaciones no.</Text>
          </View>

          <Pressable onPress={() => openStyleSheet(false)} style={styles.styleRow} accessibilityRole="button" accessibilityLabel="Cambiar estilo">
            <Text style={styles.styleText} numberOfLines={2}>
              {settings.styleMode === null ? 'Aún no has elegido el estilo de la semana' : styleSummary}
            </Text>
            <Text style={styles.styleLink}>Cambiar</Text>
          </Pressable>

          <View style={styles.actions}>
            <Button
              label={lockedCount ? 'Generar días sin candado' : 'Generar semana'}
              icon="sparkles-outline"
              onPress={handleGenerate}
              loading={generating}
              disabled={generating || items.length === 0 || lockedCount === 5}
              style={{ flex: 1 }}
            />
            <Button label="Guardar" icon="bookmark-outline" variant="secondary" onPress={handleSave} disabled={!planned || generating} />
          </View>

          {week.days.map((d) => (
            <DayCard
              key={d.date}
              day={d}
              weather={weather[d.dayIndex]}
              itemById={itemById}
              busy={busyDays.includes(d.dayIndex)}
              style={styleFor(d)}
              perDayStyle={settings.styleMode === 'perDay'}
              tryOnBusy={tryOnBusy.includes(d.dayIndex)}
              onToggleLock={() => toggleLock(d.dayIndex)}
              onRegenerate={() => void regenerateDay(d.dayIndex)}
              onNote={(n) => setNote(d.dayIndex, n)}
              onStyle={(s) => setDayStyle(d.dayIndex, s)}
              onToggleRepeat={() => toggleRepeat(d.dayIndex)}
              onTryOn={() => void handleTryOn(d.dayIndex)}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={styleSheet} onClose={() => setStyleSheet(false)} title="Estilo de tu semana">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.question}>¿Quieres usar el mismo estilo todos los días?</Text>
          <View style={styles.modeRow}>
            <Chip label="Sí, el mismo estilo" active={draftMode === 'same'} onPress={() => setDraftMode('same')} />
            <Chip label="No, uno por día" active={draftMode === 'perDay'} onPress={() => setDraftMode('perDay')} />
          </View>
          <Text style={styles.sheetLabel}>{draftMode === 'same' ? 'Estilo para toda la semana' : 'Estilo base (luego lo cambias en cada día)'}</Text>
          <View style={styles.styles}>
            {OUTFIT_STYLE_ORDER.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={OUTFIT_STYLES[k].label}
                onPress={() => setDraftStyle(k)}
                style={[styles.styleOption, draftStyle === k && styles.styleOptionActive]}
              >
                <Text style={[styles.styleOptionLabel, draftStyle === k && { color: colors.ivory }]}>{OUTFIT_STYLES[k].label}</Text>
                <Text style={[styles.styleOptionHint, draftStyle === k && { color: colors.taupeSoft }]}>{OUTFIT_STYLES[k].hint}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: space.sm, marginVertical: space.lg }}>
            <Button
              label={pendingGenerate && draftMode === 'same' ? 'Guardar y generar semana' : 'Guardar'}
              icon="checkmark"
              onPress={confirmStyle}
            />
            <Button label="Cancelar" variant="ghost" onPress={() => setStyleSheet(false)} />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { paddingHorizontal: space.xl, paddingBottom: 48, gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  summary: { gap: 4 },
  summaryText: { fontFamily: fonts.sans, fontSize: 14, color: colors.charcoal, fontWeight: '600' },
  summarySub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.muted },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  styleText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.ink },
  styleLink: { fontFamily: fonts.sans, fontSize: 13, fontWeight: '600', color: colors.taupeDark },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  question: { fontFamily: fonts.serif, fontSize: 18, color: colors.charcoal, marginBottom: space.md },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  sheetLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: space.sm },
  styles: { gap: space.sm },
  styleOption: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  styleOptionActive: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  styleOptionLabel: { fontFamily: fonts.serif, fontSize: 16, color: colors.charcoal },
  styleOptionHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
});
