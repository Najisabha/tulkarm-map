/**
 * CategorySelector — مكوّن اختيار التصنيف الرئيسي والفرعي.
 * مستخرج من AddPlaceModal لإمكانية إعادة الاستخدام.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface CategorySelectorProps {
  /** التصنيفات الرئيسية */
  mainCategories: CategoryItem[];
  /** التصنيفات الفرعية للتصنيف الرئيسي المختار */
  subCategories: CategoryItem[];
  /** القيمة المختارة حالياً */
  selectedMain: string;
  selectedSub: string;
  /** لون التصنيف الرئيسي المختار */
  selectedMainColor: string;
  /** جارٍ تحميل التصنيفات */
  loading: boolean;
  /** تسميات حقلي الاختيار */
  mainLabel: string;
  subLabel: string;
  /** حالة عرض القوائم */
  showMainList: boolean;
  showSubList: boolean;
  /** أحداث */
  onOpenMainList: () => void;
  onCloseMainList: () => void;
  onMainSelect: (name: string, id: string, color: string) => void;
  onOpenSubList: () => void;
  onCloseSubList: () => void;
  onSubSelect: (name: string) => void;
}

export function CategorySelector({
  mainCategories,
  subCategories,
  selectedMain,
  selectedSub,
  selectedMainColor,
  loading,
  mainLabel,
  subLabel,
  showMainList,
  showSubList,
  onOpenMainList,
  onCloseMainList,
  onMainSelect,
  onOpenSubList,
  onCloseSubList,
  onSubSelect,
}: CategorySelectorProps) {
  return (
    <>
      {/* زر اختيار التصنيف الرئيسي */}
      <TouchableOpacity style={styles.trigger} onPress={onOpenMainList}>
        <View style={styles.triggerRow}>
          <View style={[styles.colorDot, { backgroundColor: selectedMainColor || '#2E86AB' }]} />
          <Text style={styles.emoji}>
            {mainCategories.find((x) => x.name === selectedMain)?.emoji || '📦'}
          </Text>
          <Text style={[styles.triggerText, !selectedMain && styles.placeholder]}>
            {selectedMain || `اختر ${mainLabel}`}
          </Text>
        </View>
      </TouchableOpacity>

      {/* زر اختيار التصنيف الفرعي (يظهر فقط إذا اختار الرئيسي) */}
      {!!selectedMain && (
        <TouchableOpacity style={styles.trigger} onPress={onOpenSubList}>
          <View style={styles.triggerRow}>
            <View style={[styles.colorDot, { backgroundColor: selectedMainColor || '#2E86AB' }]} />
            <Text style={styles.emoji}>
              {subCategories.find((x) => x.name === selectedSub)?.emoji || '🏷️'}
            </Text>
            <Text style={[styles.triggerText, !selectedSub && styles.placeholder]}>
              {selectedSub || `اختر ${subLabel}`}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* مودال التصنيف الرئيسي */}
      <Modal
        visible={showMainList}
        transparent
        animationType="slide"
        onRequestClose={onCloseMainList}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onCloseMainList}>
                <Text style={styles.closeText}>إغلاق</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>اختر {mainLabel}</Text>
              <View style={{ width: 42 }} />
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {loading ? (
                <ActivityIndicator color="#2E86AB" />
              ) : mainCategories.length === 0 ? (
                <Text style={styles.empty}>لا توجد تصنيفات رئيسية</Text>
              ) : (
                mainCategories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.categoryCard, { borderColor: item.color || '#2E86AB' }]}
                    onPress={() => onMainSelect(item.name, item.id, item.color || '#2E86AB')}
                  >
                    <View style={[styles.colorDot, { backgroundColor: item.color || '#2E86AB' }]} />
                    <Text style={styles.categoryName}>{item.name}</Text>
                    <Text style={styles.categoryEmoji}>{item.emoji || '📦'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال التصنيف الفرعي */}
      <Modal
        visible={showSubList}
        transparent
        animationType="slide"
        onRequestClose={onCloseSubList}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onCloseSubList}>
                <Text style={styles.closeText}>إغلاق</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>اختر {subLabel}</Text>
              <View style={{ width: 42 }} />
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {loading ? (
                <ActivityIndicator color="#2E86AB" />
              ) : subCategories.length === 0 ? (
                <Text style={styles.empty}>لا توجد تصنيفات فرعية لهذا الرئيسي</Text>
              ) : (
                subCategories.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.categoryCard,
                      { borderColor: item.color || selectedMainColor || '#2E86AB' },
                    ]}
                    onPress={() => onSubSelect(item.name)}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.color || selectedMainColor || '#2E86AB' },
                      ]}
                    />
                    <Text style={styles.categoryName}>{item.name}</Text>
                    <Text style={styles.categoryEmoji}>{item.emoji || '🏷️'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  triggerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  emoji: { fontSize: 16 },
  triggerText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
  },
  placeholder: { color: '#9CA3AF' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 14,
  },
  card: {
    maxHeight: '82%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1A3A5C' },
  closeText: { fontSize: 14, fontWeight: '700', color: '#2E86AB' },
  list: { padding: 12, gap: 8 },
  categoryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  categoryName: { flex: 1, textAlign: 'right', fontWeight: '800', color: '#111827' },
  categoryEmoji: { fontSize: 20 },
  empty: { textAlign: 'center', color: '#6B7280', paddingVertical: 12 },
});
