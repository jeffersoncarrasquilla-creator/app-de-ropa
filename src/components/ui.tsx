import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Aviso simple compatible con iOS y web. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Confirmación destructiva compatible con iOS y web. */
export function confirmAction(title: string, message: string, confirmLabel = 'Eliminar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Encabezado editorial que respeta el área segura (Dynamic Island / notch). */
export function ScreenHeader({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const palette = {
    primary: { bg: colors.charcoal, fg: colors.ivory, border: colors.charcoal },
    secondary: { bg: 'transparent', fg: colors.charcoal, border: colors.charcoal },
    ghost: { bg: 'transparent', fg: colors.taupeDark, border: 'transparent' },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 15 : 17} color={palette.fg} />
      ) : null}
      <Text style={[styles.btnText, compact && { fontSize: 13 }, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  active,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
        { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? colors.ivory : colors.charcoal} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: colors.charcoal, borderColor: colors.charcoal }]}
    >
      <Text style={[styles.chipText, active && { color: colors.ivory }]}>{label}</Text>
    </Pressable>
  );
}

/** Escala 1-5 en puntos. */
export function LevelDots({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.levelRow} accessibilityLabel={`${label} ${value} de 5`}>
      <Text style={styles.levelLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={[styles.dot, n <= value && { backgroundColor: colors.taupeDark }]} />
        ))}
      </View>
    </View>
  );
}

/** Interruptor con la paleta de la app (en web RN-Web exige activeThumbColor aparte). */
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const webProps = Platform.OS === 'web' ? ({ activeThumbColor: colors.card, activeTrackColor: colors.taupeDark } as object) : {};
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.taupeDark, false: colors.taupeSoft }}
      thumbColor={colors.card}
      ios_backgroundColor={colors.taupeSoft}
      {...webProps}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** Hoja modal inferior. */
export function Sheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function LoadingOverlay({ visible, message }: { visible: boolean; message: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.overlayCard}>
          <ActivityIndicator color={colors.charcoal} />
          <Text style={styles.overlayText}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    backgroundColor: colors.ivory,
  },
  kicker: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.taupeDark,
    marginBottom: 4,
  },
  title: { fontFamily: fonts.serif, fontSize: 34, color: colors.charcoal, letterSpacing: -0.5 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  btnCompact: { paddingVertical: 9, paddingHorizontal: 14 },
  btnText: { fontFamily: fonts.sans, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelLabel: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, width: 62 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.taupeSoft },
  section: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.taupeDark,
    marginBottom: space.sm,
    marginTop: space.lg,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.taupeSoft, marginBottom: space.md },
  sheetTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.charcoal, marginBottom: space.md },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  overlayCard: {
    backgroundColor: colors.paper,
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: space.md,
    maxWidth: 280,
  },
  overlayText: { fontFamily: fonts.sans, fontSize: 14, color: colors.ink, textAlign: 'center' },
});
