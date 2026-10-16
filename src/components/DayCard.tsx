import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../lib/theme';
import type { DayPlan, DayWeather, Garment, OutfitStyle } from '../lib/types';
import { DAY_NAMES, OUTFIT_STYLE_ORDER, OUTFIT_STYLES } from '../lib/types';
import { shortDate } from '../lib/dates';
import { Button, Chip, IconButton } from './ui';
import { GarmentImage } from './GarmentImage';

const SLOTS: { key: 'thirdId' | 'dressId' | 'topId' | 'bottomId' | 'shoesId' | 'accessoryId'; label: string }[] = [
  { key: 'thirdId', label: 'Tercera pieza' },
  { key: 'dressId', label: 'Vestido' },
  { key: 'topId', label: 'Blusa/Top' },
  { key: 'bottomId', label: 'Inferior' },
  { key: 'shoesId', label: 'Calzado' },
  { key: 'accessoryId', label: 'Accesorio' },
];

export function DayCard({
  day,
  weather,
  itemById,
  busy,
  style,
  perDayStyle,
  tryOnBusy,
  onToggleLock,
  onRegenerate,
  onNote,
  onStyle,
  onToggleRepeat,
  onTryOn,
}: {
  day: DayPlan;
  weather?: DayWeather;
  itemById: Map<string, Garment>;
  busy: boolean;
  style: OutfitStyle;
  /** Modo "estilo por día": muestra el selector de estilo en la tarjeta. */
  perDayStyle: boolean;
  tryOnBusy: boolean;
  onToggleLock: () => void;
  onRegenerate: () => void;
  onNote: (note: string) => void;
  onStyle: (s: OutfitStyle) => void;
  onToggleRepeat: () => void;
  onTryOn: () => void;
}) {
  const look = day.look;
  const meta = OUTFIT_STYLES[style];
  return (
    <View style={[styles.card, day.locked && styles.cardLocked]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.day}>{DAY_NAMES[day.dayIndex]}</Text>
          <Text style={styles.date}>{shortDate(day.date)}</Text>
        </View>
        {weather ? (
          <View style={styles.weather}>
            <Ionicons name={weather.rainProb >= 50 ? 'rainy-outline' : 'partly-sunny-outline'} size={15} color={colors.taupeDark} />
            <Text style={styles.weatherText}>
              {weather.min}–{weather.max} °C · {weather.rainProb} %{weather.estimated ? ' (est.)' : ''}
            </Text>
          </View>
        ) : null}
        <IconButton
          icon={day.locked ? 'lock-closed' : 'lock-open-outline'}
          label={day.locked ? 'Desbloquear look' : 'Fijar look con candado'}
          active={day.locked}
          disabled={!look || busy}
          onPress={onToggleLock}
        />
      </View>

      {perDayStyle ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {OUTFIT_STYLE_ORDER.map((k) => (
            <Chip key={k} label={OUTFIT_STYLES[k].label} active={style === k} onPress={() => !day.locked && onStyle(k)} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.styleTag}>Estilo {meta.label}</Text>
      )}

      {busy ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.charcoal} />
          <Text style={styles.placeholderText}>Armando look…</Text>
        </View>
      ) : look ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {SLOTS.map(({ key, label }) => {
              const id = look[key];
              if (!id) return null;
              const g = itemById.get(id);
              return (
                <View key={key} style={styles.piece}>
                  <GarmentImage garment={g} style={styles.pieceImg} />
                  <Text style={styles.pieceLabel}>{label}</Text>
                  <Text style={styles.pieceName} numberOfLines={2}>
                    {g?.name ?? 'Prenda eliminada'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          {look.rationale ? <Text style={styles.rationale}>{look.rationale}</Text> : null}
          {day.source ? <Text style={styles.source}>{day.source === 'gemini' ? 'Sugerido por la IA' : 'Motor de reglas local (respaldo)'}</Text> : null}

          {day.tryOnUri ? <Image source={{ uri: day.tryOnUri }} style={styles.tryOn} resizeMode="cover" accessibilityLabel="Así te verías con este look" /> : null}
          <Button
            label={tryOnBusy ? 'Creando tu imagen…' : day.tryOnUri ? 'Volver a generar la imagen' : 'Ver cómo me queda'}
            icon="person-outline"
            variant={day.tryOnUri ? 'ghost' : 'secondary'}
            compact
            loading={tryOnBusy}
            disabled={tryOnBusy}
            onPress={onTryOn}
          />
        </>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{day.error ?? 'Sin look todavía. Pulsa “Generar semana”.'}</Text>
        </View>
      )}

      {day.warnings?.map((w, i) => (
        <View key={i} style={styles.warn}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.warnText}>{w}</Text>
        </View>
      ))}
      {look && day.error ? <Text style={styles.warnText}>{day.error}</Text> : null}

      <TextInput
        value={day.note}
        onChangeText={onNote}
        editable={!day.locked}
        placeholder='Nota rápida: “Elegante y solo para el jueves, no generes más looks”'
        placeholderTextColor={colors.muted}
        style={[styles.note, day.locked && { opacity: 0.5 }]}
        multiline
      />
      <View style={styles.repeatRow}>
        <Chip label={day.allowRepeat ? '✓ Permitir repetir un look' : 'Permitir repetir un look'} active={!!day.allowRepeat} onPress={() => !day.locked && onToggleRepeat()} />
      </View>
      <Button
        label={day.locked ? 'Bloqueado con candado' : 'Regenerar solo este día'}
        icon={day.locked ? 'lock-closed' : 'refresh'}
        variant="secondary"
        compact
        disabled={day.locked || busy}
        onPress={onRegenerate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
  },
  cardLocked: { borderColor: colors.charcoal },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  day: { fontFamily: fonts.serif, fontSize: 22, color: colors.charcoal },
  date: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ivory,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  weatherText: { fontFamily: fonts.sans, fontSize: 11, color: colors.taupeDark },
  piece: { width: 92 },
  styleTag: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.taupeDark },
  tryOn: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.ivory, maxWidth: 420, alignSelf: 'center' },
  repeatRow: { flexDirection: 'row' },
  pieceImg: { width: 92, height: 122, borderRadius: radius.sm },
  pieceLabel: {
    fontFamily: fonts.sans,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.taupeDark,
    marginTop: 6,
  },
  pieceName: { fontFamily: fonts.sans, fontSize: 12, color: colors.ink, marginTop: 2 },
  rationale: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 14, lineHeight: 20, color: colors.ink },
  source: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  placeholder: {
    minHeight: 90,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.taupeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    gap: space.sm,
  },
  placeholderText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  warn: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  warnText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.danger },
  note: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    minHeight: 44,
  },
});
