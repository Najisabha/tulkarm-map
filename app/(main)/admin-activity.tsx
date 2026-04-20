import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../../api/client';
import { AdminActivityLogCard } from '../../components/admin/AdminActivityLogCard';
import { adminActivityStyles as styles } from '../../components/admin/AdminActivity.styles';
import { AdminLoadingBlock } from '../../components/admin/AdminLoadingBlock';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useAuth } from '../../context/AuthContext';
import type { LogEntry } from '../../utils/admin/activityHelpers';

export default function AdminActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    try {
      const res = await api.getActivityLog();
      setEntries(res.data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader title="سجل النشاط" onBack={() => router.back()} />
      <View style={styles.topActions}>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadActivity}>
          <Text style={styles.refreshBtnText}>🔄 تحديث</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.listContent}>
        {loading ? (
          <AdminLoadingBlock message="جاري التحميل..." />
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateText}>لا يوجد سجل نشاط بعد</Text>
          </View>
        ) : (
          entries.map((entry) => <AdminActivityLogCard key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </View>
  );
}
