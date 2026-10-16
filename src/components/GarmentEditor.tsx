import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../lib/theme';
import type { Category, Garment, Level } from '../lib/types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../lib/types';
import { Button, Chip, SectionLabel, Sheet, Toggle } from './ui';

function LevelPicker({ value, onChange, label }: { value: Level; onChange: (v: Level) => void; label: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {([1, 2, 3, 4, 5] as Level[]).map((n) => (
          <Pressable
            key={n}
            accessibilityLabel={`${label} ${n}`}
            onPress={() => onChange(n)}
            style={[s.level, n === value && { backgroundColor: colors.charcoal, borderColor: colors.charcoal }]}
          >
            <Text style={[s.levelText, n === value && { color: colors.ivory }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={s.input}
      />
    </View>
  );
}

/** Hoja para revisar/corregir las etiquetas (automáticas de Gemini o manuales). */
export function GarmentEditor({
  garment,
  visible,
  isNew,
  aiMessage,
  onSave,
  onDelete,
  onClose,
}: {
  garment: Garment | null;
  visible: boolean;
  isNew: boolean;
  aiMessage?: string;
  onSave: (g: Garment) => void;
  onDelete?: (g: Garment) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Garment | null>(garment);
  useEffect(() => setDraft(garment), [garment]);
  if (!draft) return null;
  const set = <K extends keyof Garment>(k: K, v: Garment[K]) => setDraft({ ...draft, [k]: v });

  return (
    <Sheet visible={visible} onClose={onClose} title={isNew ? 'Nueva prenda' : 'Editar prenda'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Image source={{ uri: draft.imageUri }} style={s.photo} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.badge}>{draft.aiTagged ? 'Etiquetado por Gemini' : 'Etiquetado manual'}</Text>
            {aiMessage ? <Text style={s.aiMsg}>{aiMessage}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.swatch, { backgroundColor: draft.colorHex }]} />
              <Text style={s.meta}>{draft.color || 'sin color'}</Text>
            </View>
          </View>
        </View>

        <SectionLabel>Categoría</SectionLabel>
        <View style={s.wrap}>
          {CATEGORY_ORDER.map((c: Category) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={draft.category === c} onPress={() => set('category', c)} />
          ))}
        </View>

        <SectionLabel>Detalle</SectionLabel>
        <Field label="Nombre" value={draft.name} onChangeText={(v) => set('name', v)} placeholder="Blazer camel de lana" />
        <Field label="Tipo" value={draft.subtype} onChangeText={(v) => set('subtype', v)} placeholder="Blazer, Abrigo, Falda lápiz…" />
        <Field label="Color" value={draft.color} onChangeText={(v) => set('color', v)} placeholder="azul marino" />
        <Field label="Textura" value={draft.texture} onChangeText={(v) => set('texture', v)} placeholder="lana, crepé, seda…" />

        <SectionLabel>Clima y oficina</SectionLabel>
        <LevelPicker label="Abrigo térmico" value={draft.warmth} onChange={(v) => set('warmth', v)} />
        <LevelPicker label="Formalidad ejecutiva" value={draft.formality} onChange={(v) => set('formality', v)} />
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Apto para lluvia</Text>
          <Toggle value={draft.rainSafe} onValueChange={(v) => set('rainSafe', v)} />
        </View>

        <View style={{ gap: space.sm, marginTop: space.lg, marginBottom: space.md }}>
          <Button
            label={isNew ? 'Guardar en mi clóset' : 'Guardar cambios'}
            icon="checkmark"
            onPress={() => onSave({ ...draft, name: draft.name.trim() || draft.subtype || 'Prenda' })}
          />
          {!isNew && onDelete ? (
            <Button label="Eliminar prenda" icon="trash-outline" variant="danger" onPress={() => onDelete(draft)} />
          ) : null}
          <Button label="Cancelar" variant="ghost" onPress={onClose} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  photo: { width: 96, height: 128, borderRadius: radius.sm, backgroundColor: colors.ivory },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.taupeDark,
    borderWidth: 1,
    borderColor: colors.taupeSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  aiMsg: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  meta: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fieldLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: 6 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  level: {
    width: 44,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  levelText: { fontFamily: fonts.sans, fontSize: 15, color: colors.charcoal },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  switchLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.charcoal },
});
