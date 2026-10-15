import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../lib/store';
import { colors, fonts, radius, space } from '../lib/theme';
import { longDate } from '../lib/dates';
import { lookItemIds } from '../lib/planner';
import { pingGemini } from '../lib/gemini';
import { secureStorageAvailable } from '../lib/secrets';
import { DEFAULT_SETTINGS } from '../lib/types';
import { Button, ScreenHeader, SectionLabel, Toggle, confirmAction, notify } from '../components/ui';
import { GarmentImage } from '../components/GarmentImage';

type Tab = 'historial' | 'ajustes';

export default function HistorySettingsScreen() {
  const [tab, setTab] = useState<Tab>('historial');
  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Cápsula Ejecutiva" title={tab === 'historial' ? 'Historial' : 'Ajustes'} />
      <View style={styles.segment}>
        {(['historial', 'ajustes'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segBtn, tab === t && styles.segActive]}>
            <Text style={[styles.segText, tab === t && { color: colors.ivory }]}>{t === 'historial' ? 'Historial' : 'Ajustes'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'historial' ? <HistoryPanel /> : <SettingsPanel />}
    </View>
  );
}

function HistoryPanel() {
  const { history, itemById, deleteHistory } = useStore();
  if (!history.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="time-outline" size={40} color={colors.taupe} />
        <Text style={styles.emptyTitle}>Sin looks guardados</Text>
        <Text style={styles.emptyText}>
          En “Semana”, pulsa “Guardar en Historial” cuando confirmes tus looks. Los looks completos del Historial nunca se repiten.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {history.map((h) => (
        <View key={h.id} style={styles.histCard}>
          <View style={styles.histHead}>
            <Text style={styles.histDate}>{longDate(h.date)}</Text>
            <Pressable
              hitSlop={10}
              accessibilityLabel="Eliminar del historial"
              onPress={async () => {
                const ok = await confirmAction('Eliminar del Historial', 'Este look podrá volver a proponerse en el futuro.');
                if (ok) deleteHistory(h.id);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.histRow}>
            {lookItemIds(h.look).map((id) => (
              <GarmentImage key={id} garment={itemById.get(id)} style={styles.histImg} />
            ))}
          </View>
          {h.look.rationale ? (
            <Text style={styles.histNote} numberOfLines={3}>
              {h.look.rationale}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function SettingsPanel() {
  const { apiKey, saveApiKey, settings, updateSettings, items, history, clearAll } = useStore();
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [modelDraft, setModelDraft] = useState(settings.model);
  const [testing, setTesting] = useState(false);
  useEffect(() => setKeyDraft(apiKey), [apiKey]);
  useEffect(() => setModelDraft(settings.model), [settings.model]);

  async function save() {
    await saveApiKey(keyDraft);
    updateSettings({ model: modelDraft.trim() || DEFAULT_SETTINGS.model });
    notify('Ajustes guardados', secureStorageAvailable ? 'La API Key quedó en el llavero seguro del iPhone (SecureStore).' : 'La API Key quedó guardada localmente en este navegador.');
  }

  async function test() {
    setTesting(true);
    try {
      await pingGemini(keyDraft.trim(), modelDraft.trim() || DEFAULT_SETTINGS.model);
      notify('Conexión correcta', `Gemini respondió con el modelo ${modelDraft}.`);
    } catch (e) {
      notify('Error de conexión', (e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionLabel>Google Gemini</SectionLabel>
      <View style={styles.card}>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          value={keyDraft}
          onChangeText={setKeyDraft}
          placeholder="AIza…"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.help}>
          {secureStorageAvailable
            ? 'Se guarda cifrada en el llavero de iOS (expo-secure-store).'
            : 'Versión web: el navegador no tiene llavero; se guarda solo en este dispositivo (IndexedDB).'}{' '}
          Obtén tu clave en aistudio.google.com.
        </Text>
        <Text style={[styles.label, { marginTop: space.md }]}>Modelo</Text>
        <TextInput
          value={modelDraft}
          onChangeText={setModelDraft}
          placeholder={DEFAULT_SETTINGS.model}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.help}>Predeterminado: {DEFAULT_SETTINGS.model}. Puedes escribir cualquier modelo multimodal de Gemini disponible para tu clave.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Button label="Guardar" icon="checkmark" onPress={() => void save()} style={{ flex: 1 }} />
          <Button label="Probar" icon="pulse-outline" variant="secondary" onPress={() => void test()} loading={testing} disabled={!keyDraft.trim()} />
        </View>
      </View>

      <SectionLabel>Planificador</SectionLabel>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Armar looks con Gemini</Text>
            <Text style={styles.help}>Cada propuesta se valida con las reglas estrictas; si falla, se usa el motor local.</Text>
          </View>
          <Toggle value={settings.useGeminiPlanner} onValueChange={(v) => updateSettings({ useGeminiPlanner: v })} />
        </View>
        <View style={[styles.row, { marginTop: space.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Planear la próxima semana</Text>
            <Text style={styles.help}>Apagado: semana en curso (sábado y domingo saltan al lunes siguiente).</Text>
          </View>
          <Toggle value={settings.weekOffset === 1} onValueChange={(v) => updateSettings({ weekOffset: v ? 1 : 0 })} />
        </View>
      </View>

      <SectionLabel>Datos en este teléfono</SectionLabel>
      <View style={styles.card}>
        <Text style={styles.help}>
          {items.length} prendas · {history.length} looks en Historial. Todo se guarda localmente: fotos JPEG comprimidas y base de
          datos en el dispositivo. Nada se sube a servidores salvo la foto enviada a Gemini para etiquetarla.
        </Text>
        <Button
          label="Borrar todos los datos"
          icon="trash-outline"
          variant="danger"
          style={{ marginTop: space.md }}
          onPress={async () => {
            const ok = await confirmAction('Borrar todo', 'Se eliminarán prendas, fotos, semana e Historial. La API Key se conserva.', 'Borrar');
            if (ok) await clearAll();
          }}
        />
      </View>
      <Text style={styles.footer}>Cápsula Ejecutiva · Bogotá 2.640 m · 9–19 °C</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.xl,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.charcoal,
    borderRadius: radius.pill,
    padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: colors.charcoal },
  segText: { fontFamily: fonts.sans, fontSize: 13, fontWeight: '600', color: colors.charcoal },
  content: { paddingHorizontal: space.xl, paddingBottom: 48, gap: space.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl, gap: space.md, paddingBottom: 80 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.charcoal },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  histCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histDate: { fontFamily: fonts.serif, fontSize: 18, color: colors.charcoal },
  histRow: { flexDirection: 'row', gap: 6 },
  histImg: { flex: 1, aspectRatio: 3 / 4, borderRadius: radius.sm, maxWidth: 90 },
  histNote: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 13, lineHeight: 18, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginBottom: 6 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  help: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.charcoal },
  footer: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1, color: colors.muted, textAlign: 'center', marginTop: space.lg },
});
