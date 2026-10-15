import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from '../lib/store';
import { colors, fonts } from '../lib/theme';
import { DialogHost } from '../components/ui';

function TabsNavigator() {
  const { ready } = useStore();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.charcoal} />
      </View>
    );
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ivory },
        tabBarActiveTintColor: colors.charcoal,
        tabBarInactiveTintColor: colors.taupe,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          ...(Platform.OS === 'web' ? { height: 64 } : null),
        },
        tabBarLabelStyle: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mi Clóset',
          tabBarIcon: ({ color, size }) => <Ionicons name="shirt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="semana"
        options={{
          title: 'Semana',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Historial/Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="+not-found" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <TabsNavigator />
        <DialogHost />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
