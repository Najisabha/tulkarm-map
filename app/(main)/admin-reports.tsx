import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AdminLoadingBlock } from '../../components/admin/AdminLoadingBlock';
import { AdminReportCard } from '../../components/admin/AdminReportCard';
import { adminReportsStyles as styles } from '../../components/admin/AdminReports.styles';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useAdminReports } from '../../hooks/admin/useAdminReports';
import { useAuthStore } from '../../stores/useAuthStore';

export default function AdminReportsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const reportsState = useAdminReports();

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader
        title="الإبلاغات"
        onBack={() => router.back()}
        badgeText={`${reportsState.pendingCount} قيد الانتظار`}
      />

      <View style={styles.content}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, reportsState.filter === 'pending' && styles.filterBtnActive]}
            onPress={() => reportsState.setFilter('pending')}
          >
            <Text style={[styles.filterText, reportsState.filter === 'pending' && styles.filterTextActive]}>
              قيد الانتظار
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, reportsState.filter === 'all' && styles.filterBtnActive]}
            onPress={() => reportsState.setFilter('all')}
          >
            <Text style={[styles.filterText, reportsState.filter === 'all' && styles.filterTextActive]}>
              الكل
            </Text>
          </TouchableOpacity>
        </View>

        {reportsState.loading ? (
          <AdminLoadingBlock message="جاري التحميل..." />
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {reportsState.filteredReports.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>📋</Text>
                <Text style={styles.emptyStateText}>لا توجد إبلاغات</Text>
              </View>
            ) : (
              reportsState.filteredReports.map((r) => (
                <AdminReportCard
                  key={r.id}
                  report={r}
                  onResolve={(x) => reportsState.updateStatus(x, 'resolved')}
                  onDismiss={(x) => reportsState.updateStatus(x, 'dismissed')}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
