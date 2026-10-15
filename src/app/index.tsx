import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore, newId } from '../lib/store';
import { colors, fonts, radius, space } from '../lib/theme';
import type { Category, Garment } from '../lib/types';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../lib/types';
import { pickPhoto, processAndStorePhoto, type PickSource } from '../lib/images';
import { tagGarment } from '../lib/gemini';
import { Button, Chip, LevelDots, LoadingOverlay, ScreenHeader, Sheet, confirmAction, notify } from '../components/ui';
import { GarmentImage } from '../components/GarmentImage';
import { GarmentEditor } from '../components/GarmentEditor';

type Filter = 'all' | Category;

export default function ClosetScreen() {
  const { items, addGarment, updateGarment, deleteGarment, apiKey, settings } = useStore();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ garment: Garment; isNew: boolean; aiMessage?: string } | null>(null);

  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.category === filter)), [items, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [items]);

  const columns = Math.min(4, Math.max(2, Math.floor(Math.min(width, 900) / 190)));
  const cardWidth = (Math.min(width, 900) - space.xl * 2 - space.md * (columns - 1)) / columns;

  async function handlePick(source: PickSource) {
    setPickerOpen(false);
    try {
      // En iOS nativo se espera a que la hoja se cierre antes de presentar el selector.
      // En web no: Safari exige que el selector de archivos se abra dentro del mismo toque.
      if (Platform.OS !== 'web') await new Promise((r) => setTimeout(r, 350));
      const uri = await pickPhoto(source);
      if (!uri) return;
      const id = newId();
      setBusy('Convirtiendo a JPEG y comprimiendo…');
      const photo = await processAndStorePhoto(uri, id);
      const base: Garment = {
        id,
        imageUri: photo.uri,
        createdAt: new Date().toISOString(),
        category: 'top',
        subtype: '',
        name: '',
        color: '',
        colorHex: '#A39382',
        texture: '',
        warmth: 3,
        formality: 3,
        rainSafe: false,
        aiTagged: false,
      };
      let aiMessage: string | undefined;
      if (apiKey) {
        setBusy(`Analizando la prenda con ${settings.model}…`);
        try {
          const tags = await tagGarment(apiKey, settings.model, photo.base64);
          Object.assign(base, tags, { aiTagged: true });
        } catch (e) {
          aiMessage = `${(e as Error).message} Completa las etiquetas manualmente.`;
        }
      } else {
        aiMessage = 'Sin API Key de Gemini: etiqueta manualmente o configúrala en Historial/Ajustes.';
      }
      setBusy(null);
      setEditing({ garment: base, isNew: true, aiMessage });
    } catch (e) {
      setBusy(null);
      notify('No se pudo agregar la foto', (e as Error).message);
    }
  }

  function handleSave(g: Garment) {
    if (editing?.isNew) addGarment(g);
    else updateGarment(g);
    setEditing(null);
  }

  async function handleDelete(g: Garment) {
    const ok = await confirmAction('Eliminar prenda', `¿Eliminar "${g.name}" de tu clóset?`);
    if (!ok) return;
    deleteGarment(g.id);
    setEditing(null);
  }

  const renderItem = ({ item }: { item: Garment }) => (
    <Pressable
      onPress={() => setEditing({ garment: item, isNew: false })}
      style={({ pressed }) => [styles.card, { width: cardWidth, opacity: pressed ? 0.85 : 1 }]}
    >
      <GarmentImage garment={item} style={{ width: '100%', aspectRatio: 3 / 4 }} />
      <View style={styles.cardBody}>
        <Text style={styles.cardCat}>{CATEGORY_LABEL[item.category]}</Text>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.colorRow}>
          <View style={[styles.swatch, { backgroundColor: item.colorHex }]} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[item.color, item.texture].filter(Boolean).join(' · ')}
          </Text>
          {item.rainSafe ? <Ionicons name="umbrella-outline" size={13} color={colors.taupeDark} /> : null}
        </View>
        <LevelDots label="Abrigo" value={item.warmth} />
        <LevelDots label="Formal" value={item.formality} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker={`${items.length} prendas · Bogotá 9–19 °C`} title="Mi Clóset" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label={`Todo ${items.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} label={`${CATEGORY_LABEL[c]} ${counts[c] ?? 0}`} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={44} color={colors.taupe} />
          <Text style={styles.emptyTitle}>{items.length ? 'Nada en esta categoría' : 'Tu cápsula empieza aquí'}</Text>
          <Text style={styles.emptyText}>
            Pulsa + para fotografiar una prenda o elegirla de tu fototeca. Gemini la etiquetará automáticamente. Para planear la
            semana necesitas al menos 5 blusas, 5 terceras piezas, 5 pantalones/faldas y 2 pares de zapatos.
          </Text>
        </View>
      ) : (
        <FlatList
          key={columns}
          data={visible}
          keyExtractor={(i) => i.id}
          numColumns={columns}
          renderItem={renderItem}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 120, gap: space.md }}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agregar prenda"
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={30} color={colors.ivory} />
      </Pressable>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Agregar prenda">
        <View style={{ gap: space.sm, paddingBottom: space.sm }}>
          <Button label="Tomar foto" icon="camera-outline" onPress={() => handlePick('camera')} />
          <Button label="Elegir de la fototeca" icon="images-outline" variant="secondary" onPress={() => handlePick('library')} />
          <Button label="Cancelar" variant="ghost" onPress={() => setPickerOpen(false)} />
        </View>
      </Sheet>

      <GarmentEditor
        visible={!!editing}
        garment={editing?.garment ?? null}
        isNew={!!editing?.isNew}
        aiMessage={editing?.aiMessage}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setEditing(null)}
      />
      <LoadingOverlay visible={!!busy} message={busy ?? ''} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  filters: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardBody: { padding: space.md, gap: 5 },
  cardCat: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.taupeDark },
  cardName: { fontFamily: fonts.serif, fontSize: 16, color: colors.charcoal },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  swatch: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.line },
  cardMeta: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl, gap: space.md, paddingBottom: 80 },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.charcoal },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: space.xl,
    bottom: space.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
