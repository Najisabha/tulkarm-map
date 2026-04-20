import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { PlaceCategoryTreeItem } from '../../types/placeCategories';
import type { PlaceCategoryRow } from '../../utils/admin/classificationTreeHelpers';
import { adminClassificationTreeStyles as styles } from './AdminClassificationTree.styles';

interface AdminClassificationTreeListProps {
  loadingTree: boolean;
  refreshing: boolean;
  tree: PlaceCategoryTreeItem[];
  allItemsFlat: PlaceCategoryRow[];
  onRefresh: () => void;
  onAddMain: () => void;
  onAddSub: (mainId: string) => void;
  onEdit: (item: PlaceCategoryRow) => void;
  onDelete: (item: PlaceCategoryRow) => void;
}

export function AdminClassificationTreeList({
  loadingTree,
  refreshing,
  tree,
  allItemsFlat,
  onRefresh,
  onAddMain,
  onAddSub,
  onEdit,
  onDelete,
}: AdminClassificationTreeListProps) {
  return (
    <View style={styles.contentFlex}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity style={styles.addBtn} onPress={onAddMain}>
          <Text style={styles.addBtnText}>+ تصنيف رئيسي</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A3A5C" />}
      >
        {loadingTree && tree.length === 0 ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#1A3A5C" />
            <Text style={styles.loadingText}>جاري التحميل…</Text>
          </View>
        ) : tree.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌳</Text>
            <Text style={styles.emptyText}>لا توجد تصنيفات بعد — أضف أول تصنيف رئيسي</Text>
          </View>
        ) : (
          tree.map((item) => {
            const mainRow = allItemsFlat.find((r) => r.id === item.main.id);
            return (
              <View key={item.main.id} style={styles.mainBlock}>
                <View style={styles.mainRow}>
                  <View style={[styles.colorDotBig, { backgroundColor: item.main.color || '#2E86AB' }]} />
                  {item.main.emoji ? <Text style={styles.mainEmoji}>{item.main.emoji}</Text> : null}
                  <Text style={styles.mainName}>{item.main.name}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.subBtn]} onPress={() => onAddSub(item.main.id)}>
                    <Text style={[styles.actionText, styles.subBtnText]}>+ فرعي</Text>
                  </TouchableOpacity>
                  {mainRow ? (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => onEdit(mainRow)}>
                        <Text style={[styles.actionText, styles.editBtnText]}>تعديل</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.delBtn]} onPress={() => onDelete(mainRow)}>
                        <Text style={[styles.actionText, styles.delBtnText]}>حذف</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>

                {item.sub_categories.length === 0 ? (
                  <Text style={styles.noSubs}>— لا يوجد تصنيف فرعي</Text>
                ) : (
                  item.sub_categories.map((sub) => {
                    const subRow = allItemsFlat.find((r) => r.id === sub.id);
                    return (
                      <View key={sub.id} style={styles.subRow}>
                        <View style={styles.subInfo}>
                          {sub.emoji ? <Text style={styles.subEmoji}>{sub.emoji}</Text> : null}
                          <Text style={styles.subName}>{sub.name}</Text>
                        </View>
                        {subRow ? (
                          <View style={styles.subActions}>
                            <TouchableOpacity onPress={() => onEdit(subRow)}>
                              <Text style={styles.miniEditText}>تعديل</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onDelete(subRow)}>
                              <Text style={styles.miniDelText}>حذف</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
