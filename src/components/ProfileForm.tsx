import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../lib/theme';
import type { UserProfile } from '../lib/types';
import { BODY_TYPES, SKIN_SEASONS, STYLE_OPTIONS, UNDERTONES } from '../lib/types';
import { Button, Chip, SectionLabel, notify } from './ui';
import { deleteStoredPhoto, pickPhotos, processAndStorePhoto, type PickSource } from '../lib/images';

export type ProfileSection = 'basic' | 'body' | 'all';

function toNumber(text: string, max: number): number | null {
  const n = Number(text.replace(',', '.').replace(/[^0-9.]/g, ''));
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(max, Math.round(n));
}

function Field({
  id,
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  unit,
}: {
  id: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  unit?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputRow}>
        <TextInput
          nativeID={id}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={numeric ? 'number-pad' : 'default'}
          autoCapitalize={numeric ? 'none' : 'sentences'}
          style={[s.input, { flex: 1 }]}
        />
        {unit ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

/** Datos básicos y biométricos del perfil. Se usa en el onboarding (por secciones) y en Ajustes (completo). */
export function ProfileForm({
  value,
  onChange,
  section = 'all',
}: {
  value: UserProfile;
  onChange: (p: UserProfile) => void;
  section?: ProfileSection;
}) {
  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => onChange({ ...value, [k]: v });
  const num = (v: number | null) => (v == null ? '' : String(v));
  const showBasic = section !== 'body';
  const showBody = section !== 'basic';

  return (
    <View>
      {showBasic ? (
        <>
          <SectionLabel>Sobre ti</SectionLabel>
          <Field id="perfil-nombre" label="Nombre" value={value.name} onChangeText={(v) => set('name', v)} placeholder="¿Cómo te llamamos?" />
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field id="perfil-edad" label="Edad" value={num(value.age)} onChangeText={(v) => set('age', toNumber(v, 110))} numeric unit="años" />
            </View>
            <View style={{ flex: 2 }}>
              <Field id="perfil-profesion" label="Profesión" value={value.profession} onChangeText={(v) => set('profession', v)} placeholder="Abogada, gerente…" />
            </View>
          </View>
          <Text style={s.label}>Estilo personal preferido</Text>
          <View style={s.wrap}>
            {STYLE_OPTIONS.map((st) => (
              <Chip key={st} label={st} active={value.style === st} onPress={() => set('style', st)} />
            ))}
          </View>
        </>
      ) : null}

      {showBody ? (
        <>
          <SectionLabel>Silueta</SectionLabel>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field id="perfil-altura" label="Altura" value={num(value.heightCm)} onChangeText={(v) => set('heightCm', toNumber(v, 230))} numeric unit="cm" />
            </View>
            <View style={{ flex: 1 }}>
              <Field id="perfil-peso" label="Peso" value={num(value.weightKg)} onChangeText={(v) => set('weightKg', toNumber(v, 300))} numeric unit="kg" />
            </View>
          </View>
          <Text style={s.label}>Tipo de cuerpo</Text>
          <View style={s.options}>
            {BODY_TYPES.map((b) => (
              <Option key={b.key} label={b.label} hint={b.hint} active={value.bodyType === b.key} onPress={() => set('bodyType', value.bodyType === b.key ? null : b.key)} />
            ))}
          </View>
          <Text style={[s.label, { marginTop: space.md }]}>Medidas (opcional)</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field id="perfil-busto" label="Busto" value={num(value.bustCm)} onChangeText={(v) => set('bustCm', toNumber(v, 200))} numeric unit="cm" />
            </View>
            <View style={{ flex: 1 }}>
              <Field id="perfil-cintura" label="Cintura" value={num(value.waistCm)} onChangeText={(v) => set('waistCm', toNumber(v, 200))} numeric unit="cm" />
            </View>
            <View style={{ flex: 1 }}>
              <Field id="perfil-cadera" label="Cadera" value={num(value.hipCm)} onChangeText={(v) => set('hipCm', toNumber(v, 200))} numeric unit="cm" />
            </View>
          </View>

          <SectionLabel>Colorimetría</SectionLabel>
          <Text style={s.label}>Estación de tu tono de piel</Text>
          <View style={s.options}>
            {SKIN_SEASONS.map((c) => (
              <Option key={c.key} label={c.label} hint={c.hint} active={value.skinSeason === c.key} onPress={() => set('skinSeason', value.skinSeason === c.key ? null : c.key)} />
            ))}
          </View>
          <Text style={[s.label, { marginTop: space.md }]}>Subtono</Text>
          <View style={s.wrap}>
            {UNDERTONES.map((u) => (
              <Chip key={u.key} label={u.label} active={value.undertone === u.key} onPress={() => set('undertone', value.undertone === u.key ? null : u.key)} />
            ))}
          </View>
          <BodyPhoto value={value} onChange={onChange} />
          <Text style={s.help}>
            ¿No sabes tu subtono? Mira las venas de tu muñeca con luz natural: verdosas = cálido, azuladas = frío, ambas = neutro.
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** Foto de cuerpo entero opcional: permite que el probador virtual te muestre a ti con tus prendas. */
function BodyPhoto({ value, onChange }: { value: UserProfile; onChange: (p: UserProfile) => void }) {
  const [busy, setBusy] = useState(false);
  async function pick(source: PickSource) {
    try {
      const [uri] = await pickPhotos(source);
      if (!uri) return;
      setBusy(true);
      const photo = await processAndStorePhoto(uri, `perfil-cuerpo-${Date.now()}`);
      if (value.bodyPhotoUri) deleteStoredPhoto(value.bodyPhotoUri);
      onChange({ ...value, bodyPhotoUri: photo.uri });
    } catch (e) {
      notify('No se pudo usar la foto', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ marginTop: space.md }}>
      <SectionLabel>Probador virtual (opcional)</SectionLabel>
      <Text style={s.help}>
        Agrega una foto tuya de cuerpo entero, de frente y con buena luz, para que la IA te muestre vestida con tus prendas. Se guarda
        solo en tu teléfono y se envía a Gemini únicamente cuando pides ver un look.
      </Text>
      <View style={[s.row, { alignItems: 'center', marginTop: space.sm }]}>
        {value.bodyPhotoUri ? <Image source={{ uri: value.bodyPhotoUri }} style={s.bodyThumb} /> : null}
        <View style={{ flex: 1, gap: space.sm }}>
          <Button label="Tomar foto" icon="camera-outline" variant="secondary" compact loading={busy} onPress={() => void pick('camera')} />
          <Button label="Elegir de la galería" icon="image-outline" variant="secondary" compact disabled={busy} onPress={() => void pick('library')} />
          {value.bodyPhotoUri ? (
            <Button
              label="Quitar foto"
              variant="ghost"
              compact
              onPress={() => {
                if (value.bodyPhotoUri) deleteStoredPhoto(value.bodyPhotoUri);
                onChange({ ...value, bodyPhotoUri: undefined });
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Option({ label, hint, active, onPress }: { label: string; hint: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.option, active && s.optionActive, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[s.optionLabel, active && { color: colors.ivory }]}>{label}</Text>
      <Text style={[s.optionHint, active && { color: colors.taupeSoft }]}>{hint}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    minWidth: 0,
  },
  unit: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  options: { gap: space.sm },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  optionActive: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  optionLabel: { fontFamily: fonts.serif, fontSize: 16, color: colors.charcoal },
  optionHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  bodyThumb: { width: 84, height: 112, borderRadius: radius.sm, backgroundColor: colors.ivory },
  help: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: space.sm },
});
