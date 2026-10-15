import { Platform } from 'react-native';

export const colors = {
  ivory: '#F6F1E9',
  paper: '#FBF8F3',
  card: '#FFFDF9',
  line: '#E4DBCE',
  taupe: '#A39382',
  taupeDark: '#7D6F61',
  taupeSoft: '#D9CFC2',
  charcoal: '#2B2A28',
  ink: '#46423D',
  muted: '#8C847A',
  danger: '#9E4A3C',
  ok: '#5E6B4E',
  overlay: 'rgba(43,42,40,0.45)',
} as const;

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
  }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;
