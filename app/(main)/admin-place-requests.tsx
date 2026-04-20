import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCategories } from '../../context/CategoryContext';
import { useStores } from '../../context/StoreContext';
import { AdminLoadingBlock } from '../../components/admin/AdminLoadingBlock';
import { AdminPlaceRequestCard } from '../../components/admin/AdminPlaceRequestCard';
import { AdminPlaceRequestsFilters } from '../../components/admin/AdminPlaceRequestsFilters';
import { adminPlaceRequestsStyles as styles } from '../../components/admin/AdminPlaceRequests.styles';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useAdminPlaceRequests } from '../../hooks/admin/useAdminPlaceRequests';
import {
  normalizePlaceStatus,
  STATUS_LABELS,
} from '../../utils/admin/placeRequestsHelpers';

export default function AdminPlaceRequestsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { categories } = useCategories();
  const { stores, loading, refreshStores } = useStores();

  const requestsState = useAdminPlaceRequests({ stores, refreshStores });

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader
        title="طلبات إضافة الأماكن"
        onBack={() => router.back()}
        badgeText={`${requestsState.pendingCount} قيد الانتظار`}
      />

      <View style={styles.content}>
        <AdminPlaceRequestsFilters
          searchQuery={requestsState.searchQuery}
          onSearchChange={requestsState.setSearchQuery}
          statusFilter={requestsState.statusFilter}
          onStatusChange={requestsState.setStatusFilter}
          onRefresh={() => void refreshStores()}
        />

        {loading ? (
          <AdminLoadingBlock message="جاري التحميل..." />
        ) : requestsState.filteredPlaces.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>{requestsState.searchQuery.trim() ? '🔍' : '📋'}</Text>
            <Text style={styles.emptyStateText}>
              {requestsState.searchQuery.trim()
                ? 'لا توجد نتائج للبحث'
                : requestsState.statusFilter === 'all'
                  ? 'لا توجد أماكن'
                  : `لا توجد أماكن ${STATUS_LABELS[requestsState.statusFilter] ?? ''}`}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {requestsState.filteredPlaces.map((place) => (
              <AdminPlaceRequestCard
                key={place.id}
                place={place}
                categories={categories}
                onAccept={(item) => void requestsState.handleAccept(item)}
                onReject={(item) => void requestsState.handleReject(item)}
                onDelete={(item) => void requestsState.handleDelete(item)}
                onEdit={(item) =>
                  router.push({
                    pathname: '/(main)/admin-stores',
                    params: { editStoreId: item.id },
                  })
                }
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
