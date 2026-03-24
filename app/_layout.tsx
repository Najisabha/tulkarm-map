import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { CategoryProvider } from '../context/CategoryContext';
import { GoogleMapsLoaderProvider } from '../context/GoogleMapsLoaderContext';
import { StoreProvider } from '../context/StoreContext';
import { setupNotificationHandler } from '../utils/notifications';

setupNotificationHandler();

function WebLayoutFix() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    const style = document.createElement('style');
    style.textContent = `
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; direction: rtl; }
      #root, [data-reactroot], body > div { height: 100%; min-height: 100%; }
      .leaflet-container { height: 100% !important; z-index: 1; }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
      document.documentElement.removeAttribute('dir');
      document.documentElement.removeAttribute('lang');
    };
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CategoryProvider>
        <GoogleMapsLoaderProvider>
        <StoreProvider>
        {Platform.OS === 'web' && <WebLayoutFix />}
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </StoreProvider>
        </GoogleMapsLoaderProvider>
      </CategoryProvider>
    </AuthProvider>
  );
}
