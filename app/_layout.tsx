import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { CategoryProvider } from '../context/CategoryContext';
import { StoreProvider } from '../context/StoreContext';
import { setupNotificationHandler } from '../utils/notifications';

setupNotificationHandler();

export default function RootLayout() {
  return (
    <AuthProvider>
      <CategoryProvider>
        <StoreProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </StoreProvider>
      </CategoryProvider>
    </AuthProvider>
  );
}
