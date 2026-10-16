import React, { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import type { Garment } from '../lib/types';

export function GarmentImage({ garment, style }: { garment?: Garment; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.box, style]}>
      {garment && !failed ? (
        <Image
          source={{ uri: garment.imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={garment.name}
        />
      ) : (
        <Ionicons name="shirt-outline" size={22} color={colors.taupe} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.ivory,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
