import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';
import type { UserProfile } from '../lib/types';
import { EMPTY_PROFILE } from '../lib/types';
import { Button } from './ui';
import { ProfileForm } from './ProfileForm';

type Step = 'welcome' | 'basic' | 'body';

const STEPS: { key: Exclude<Step, 'welcome'>; kicker: string; title: string; lead: string }[] = [
  {
    key: 'basic',
    kicker: 'Paso 1 de 2',
    title: 'Cuéntanos de ti',
    lead: 'Tu profesión y tu estilo definen la formalidad de cada look.',
  },
  {
    key: 'body',
    kicker: 'Paso 2 de 2',
    title: 'Tu silueta y tu color',
    lead: 'Con tu tipo de cuerpo y tu colorimetría, la IA elige cortes y tonos que te favorecen. Todo queda solo en tu teléfono.',
  },
];

/** Bienvenida + onboarding de perfil. Se muestra la primera vez que se abre la app. */
export function Welcome({ onDone }: { onDone: (p: UserProfile) => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [draft, setDraft] = useState<UserProfile>(EMPTY_PROFILE);

  if (step === 'welcome') {
    return (
      <View style={[styles.screen, styles.welcome, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Armario cápsula · Bogotá</Text>
          <View style={styles.monogram}>
            <Ionicons name="shirt-outline" size={34} color={colors.charcoal} />
          </View>
          <Text style={styles.brand}>My Closet</Text>
          <View style={styles.rule} />
          <Text style={styles.slogan}>tu asesor de moda, siempre</Text>
          <Text style={styles.lead}>
            Fotografía tus prendas, deja que la IA las clasifique y recibe cada semana looks ejecutivos pensados para ti y para el clima
            de la ciudad.
          </Text>
        </View>
        <View style={{ gap: space.sm }}>
          <Button label="Comenzar" icon="arrow-forward" onPress={() => setStep('basic')} />
          <Text style={styles.fine}>Toma menos de un minuto</Text>
        </View>
      </View>
    );
  }

  const idx = STEPS.findIndex((s) => s.key === step);
  const meta = STEPS[idx];
  const canContinue = step !== 'basic' || draft.name.trim().length > 0;
  const finish = () => onDone({ ...draft, name: draft.name.trim(), profession: draft.profession.trim() });

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.form, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.bar, i <= idx && { backgroundColor: colors.charcoal }]} />
          ))}
        </View>
        <Text style={styles.kicker}>{meta.kicker}</Text>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.stepLead}>{meta.lead}</Text>

        <ProfileForm value={draft} onChange={setDraft} section={meta.key} />

        <View style={styles.actions}>
          <Button label="Atrás" variant="ghost" onPress={() => setStep(idx === 0 ? 'welcome' : STEPS[idx - 1].key)} />
          {step === 'basic' ? (
            <Button label="Continuar" icon="arrow-forward" onPress={() => setStep('body')} disabled={!canContinue} style={{ flex: 1 }} />
          ) : (
            <Button label="Empezar a vestirme" icon="checkmark" onPress={finish} style={{ flex: 1 }} />
          )}
        </View>
        {step === 'basic' && !canContinue ? <Text style={styles.fine}>Escribe tu nombre para continuar.</Text> : null}
        {step === 'body' ? (
          <Button label="Completar después" variant="ghost" compact onPress={finish} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  welcome: { paddingHorizontal: space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.md, maxWidth: 460, alignSelf: 'center' },
  kicker: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.taupeDark,
  },
  monogram: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.taupe,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
    backgroundColor: colors.paper,
  },
  brand: { fontFamily: fonts.serif, fontSize: 48, color: colors.charcoal, letterSpacing: -1, textAlign: 'center' },
  rule: { width: 48, height: 1, backgroundColor: colors.taupe },
  slogan: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 20, color: colors.taupeDark, textAlign: 'center' },
  lead: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.ink, textAlign: 'center', marginTop: space.md },
  fine: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, textAlign: 'center' },
  form: { paddingHorizontal: space.xl, gap: space.xs, maxWidth: 560, width: '100%', alignSelf: 'center' },
  progress: { flexDirection: 'row', gap: 6, marginBottom: space.lg },
  bar: { flex: 1, height: 2, backgroundColor: colors.taupeSoft },
  title: { fontFamily: fonts.serif, fontSize: 32, color: colors.charcoal, letterSpacing: -0.5, marginTop: 4 },
  stepLead: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignItems: 'center' },
});
