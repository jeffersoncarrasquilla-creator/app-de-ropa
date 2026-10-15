import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { colors, fonts, space } from '../lib/theme';
import { shortDate } from '../lib/dates';
import { Button, ScreenHeader, notify } from '../components/ui';
import { DayCard } from '../components/DayCard';

export default function WeekScreen() {
  const {
    week,
    weather,
    itemById,
    busyDays,
    items,
    apiKey,
    settings,
    generateWeek,
    regenerateDay,
    toggleLock,
    setNote,
    saveWeekToHistory,
  } = useStore();

  const generating = busyDays.length > 0;
  const planned = week.days.filter((d) => d.look).length;
  const lockedCount = week.days.filter((d) => d.locked).length;
  const first = week.days[0]?.date;
  const last = week.days[4]?.date;
  const engine = settings.useGeminiPlanner && apiKey ? `Gemini (${settings.model}) + reglas` : 'Motor de reglas local';

  function handleSave() {
    const n = saveWeekToHistory();
    notify(
      n ? 'Semana guardada' : 'Nada nuevo que guardar',
      n
        ? `${n} look(s) agregados al Historial. No se volverán a proponer.`
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
            <Text style={styles.summarySub}>{engine}. Sin repetir prendas principales en la semana ni looks del Historial.</Text>
          </View>
          <View style={styles.actions}>
            <Button
              label={lockedCount ? 'Generar días sin candado' : 'Generar semana'}
              icon="sparkles-outline"
              onPress={() => void generateWeek()}
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
              onToggleLock={() => toggleLock(d.dayIndex)}
              onRegenerate={() => void regenerateDay(d.dayIndex)}
              onNote={(n) => setNote(d.dayIndex, n)}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { paddingHorizontal: space.xl, paddingBottom: 48, gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  summary: { gap: 4 },
  summaryText: { fontFamily: fonts.sans, fontSize: 14, color: colors.charcoal, fontWeight: '600' },
  summarySub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
