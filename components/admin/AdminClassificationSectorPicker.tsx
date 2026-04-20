import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { ClassificationPickerItem } from '../../utils/admin/classificationTreeHelpers';
import { adminClassificationTreeStyles as styles } from './AdminClassificationTree.styles';

interface AdminClassificationSectorPickerProps {
  items: ClassificationPickerItem[];
  loading?: boolean;
  onPick: (sector: ClassificationPickerItem) => void;
  onRefresh?: () => void;
}

export function AdminClassificationSectorPicker({
  items,
  loading,
  onPick,
  onRefresh,
}: AdminClassificationSectorPickerProps) {
  const isInitialLoading = loading && items.length === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(loading)} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      <Text style={styles.intro}>اختر قطاعاً لإدارة تصنيفاته الرئيسية والفرعية.</Text>

      {isInitialLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#2E86AB" />
          <Text style={styles.loadingText}>جاري تحميل القطاعات…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🗂️</Text>
          <Text style={styles.emptyText}>
            لا توجد فئات تمتلك شجرة تصنيفات بعد. أضِف تصنيفات لفئة من شاشة الفئات لتظهر هنا.
          </Text>
        </View>
      ) : (
        <View style={styles.sectorGrid}>
          {items.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.sectorCard}
              onPress={() => onPick(s)}
              activeOpacity={0.75}
            >
              <Text style={styles.sectorEmoji}>{s.emoji}</Text>
              <Text style={styles.sectorLabel}>{s.pluralLabel}</Text>
              <Text style={styles.sectorHint}>({s.name})</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
