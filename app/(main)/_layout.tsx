import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="map" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="user-modifications" />
      <Stack.Screen name="admin-categories" />
      <Stack.Screen name="admin-stores" />
      <Stack.Screen name="admin-place-requests" />
      <Stack.Screen name="admin-users" />
      <Stack.Screen name="admin-reports" />
      <Stack.Screen name="admin-settings" />
      <Stack.Screen name="admin-activity" />
      <Stack.Screen name="admin-classification-tree" />
    </Stack>
  );
}
