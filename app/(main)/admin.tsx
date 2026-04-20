import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { AdminDashboardHeader } from '../../components/admin/AdminDashboardHeader';
import { AdminQuickMenu } from '../../components/admin/AdminQuickMenu';
import { AdminStatGrid } from '../../components/admin/AdminStatGrid';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { adminScreenStyles as screenStyles } from '../../components/admin/AdminScreen.styles';
import { useAdminDashboard } from '../../hooks/admin/useAdminDashboard';
import { useAuthPlacesBootstrap } from '../../hooks/useAuthPlacesBootstrap';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlacesStore } from '../../stores/usePlacesStore';
import { placeToStore, type Store } from '../../utils/map/storeModel';

export default function AdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editStoreId?: string }>();
  const { user, logout, init } = useAuthStore();
  const { places, loadAll } = usePlacesStore();

  /** تهيئة مشتركة: المصادقة + تحميل الأماكن بصلاحيات مدير */
  useAuthPlacesBootstrap({ init, loadAll, forceAdmin: true });

  const stores: Store[] = useMemo(() => places.map(placeToStore), [places]);

  const dashboard = useAdminDashboard({
    router,
    editStoreId: params.editStoreId,
    isAdmin: !!user?.isAdmin,
    stores,
  });

  const goToMap = () => router.replace('/(main)/map');

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={goToMap} />;
  }

  return (
    <View style={screenStyles.container}>
      <AdminDashboardHeader onBackToMap={goToMap} />
      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AdminStatGrid cards={dashboard.statCards} />
        <AdminQuickMenu
          rows={dashboard.quickMenuRows}
          onLogout={() => {
            logout();
            router.replace('/(main)/map');
          }}
        />
      </ScrollView>
    </View>
  );
}
