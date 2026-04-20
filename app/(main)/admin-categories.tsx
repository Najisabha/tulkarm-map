import { useRouter, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AdminAttributeModal } from '../../components/admin/AdminAttributeModal';
import { adminCategoriesStyles as styles } from '../../components/admin/AdminCategories.styles';
import { AdminCategoryCard } from '../../components/admin/AdminCategoryCard';
import { AdminCategoryModal } from '../../components/admin/AdminCategoryModal';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useCategories } from '../../context/CategoryContext';
import { useStores } from '../../context/StoreContext';
import { useAdminCategories } from '../../hooks/admin/useAdminCategories';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  parseAttrUiOptions,
  resolveFilterKind,
  VALUE_TYPES,
} from '../../utils/admin/categoryAdminHelpers';

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filterKind?: string }>();
  const { user } = useAuthStore();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const { stores } = useStores();
  // expo-router أحياناً قد يبدّل/يوحّد casing لأسماء query params،
  // فخلي القراءة مرنة حتى يشتغل فلتر "أنواع المتاجر" دائماً.
  const filterKind = resolveFilterKind(params as Record<string, unknown>);

  const state = useAdminCategories({
    categories,
    stores,
    filterKind,
    addCategory,
    updateCategory,
    deleteCategory,
  });

  useFocusEffect(
    React.useCallback(() => {
      if (!state.selectedCatForAttrs) return;
      void state.refreshClassificationLinked();
    }, [state.selectedCatForAttrs?.id]),
  );

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader
        title="إدارة الفئات"
        onBack={() => router.back()}
        badgeText={`${state.visibleCategories.length} فئة`}
      />

      {!state.selectedCatForAttrs ? (
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{'\u0627\u0644\u0641\u0626\u0627\u062A'}</Text>
            <View style={styles.headerActions}>
              <TextInput
                style={styles.searchInput}
                placeholder={'\u0628\u062D\u062B \u0639\u0646 \u0641\u0626\u0629...'}
                placeholderTextColor="#9CA3AF"
                value={state.searchQuery}
                onChangeText={state.setSearchQuery}
                textAlign="right"
              />
              <TouchableOpacity style={styles.addCategoryBtn} onPress={state.openAddCategory}>
                <Text style={styles.addCategoryBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {state.filteredCategories.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>{state.query ? '\u{1F50D}' : '\u{1F4C1}'}</Text>
              <Text style={styles.emptyStateText}>
                {state.query ? `\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0626\u0627\u062A \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 "${state.searchQuery}"` : '\u0644\u0627 \u062A\u0648\u062C\u062F \u0641\u0626\u0627\u062A \u0628\u0639\u062F'}
              </Text>
              {!state.query && (
                <TouchableOpacity style={styles.emptyStateBtn} onPress={state.openAddCategory}>
                  <Text style={styles.emptyStateBtnText}>{'\u0625\u0636\u0627\u0641\u0629 \u0623\u0648\u0644 \u0641\u0626\u0629'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {state.filteredCategories.map((cat) => {
                const placesCount = state.getPlacesCount(cat.name);
                return (
                  <AdminCategoryCard
                    key={cat.id}
                    category={cat}
                    placesCount={placesCount}
                    onAttrs={() => state.openAttrDefs(cat)}
                    onEdit={() => state.openEditCategory(cat)}
                    onDelete={() =>
                      Alert.alert('حذف الفئة', `حذف "${cat.name}"؟`, [
                        { text: 'إلغاء', style: 'cancel' },
                        { text: 'حذف', style: 'destructive', onPress: () => state.handleDeleteCategory(cat) },
                      ])
                    }
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : (
        /* ── Attribute Definitions View ── */
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => state.setSelectedCatForAttrs(null)}>
              <Text style={styles.attrBackText}>{'\u2192 \u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0641\u0626\u0627\u062A'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.attrHeader}>
            <View style={[styles.attrHeaderIcon, { backgroundColor: state.selectedCatForAttrs.color + '22' }]}>
              <Text style={{ fontSize: 28 }}>{state.selectedCatForAttrs.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attrHeaderTitle}>{'\u062E\u0635\u0627\u0626\u0635'} {state.selectedCatForAttrs.name}</Text>
              <Text style={styles.attrHeaderSub}>
                {'\u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u062A\u064A \u062A\u0638\u0647\u0631 \u0639\u0646\u062F \u0625\u0636\u0627\u0641\u0629 \u0645\u0643\u0627\u0646 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0646\u0648\u0639'}
              </Text>
            </View>
          </View>

          {state.loadingAttrs ? (
            <ActivityIndicator size="large" color="#2E86AB" style={{ marginTop: 30 }} />
          ) : (
            <>
              <View style={styles.attrTopActionsRow}>
                <TouchableOpacity style={[styles.addAttrBtn, styles.attrTopActionHalf]} onPress={state.openAddAttr}>
                  <Text style={styles.addAttrBtnText}>+ {'\u0625\u0636\u0627\u0641\u0629 \u062E\u0627\u0635\u064A\u0629 \u062C\u062F\u064A\u062F\u0629'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.classificationTreeCheckboxBtn,
                    styles.attrTopActionHalf,
                    state.classificationLinked && styles.classificationTreeCheckboxBtnChecked,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/admin-classification-tree',
                      params: { placeTypeName: state.selectedCatForAttrs.name },
                    })
                  }
                >
                  <Text
                    style={[
                      styles.classificationTreeCheckboxText,
                      state.classificationLinked && styles.classificationTreeCheckboxTextChecked,
                    ]}
                  >
                    {state.checkingClassificationLinked
                      ? '...'
                      : state.classificationLinked
                        ? '☑ تم وضع الصنف في شجرة التصنيفات'
                        : '☐ وضع الصنف في شجرة التصنيفات'}
                  </Text>
                </TouchableOpacity>
              </View>

              {state.attrDefs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateEmoji}>{'\u{1F4CB}'}</Text>
                  <Text style={styles.emptyStateText}>
                    {'\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u0635\u0627\u0626\u0635 \u0645\u0639\u0631\u0641\u0629 \u0628\u0639\u062F'}
                  </Text>
                  <Text style={[styles.emptyStateText, { fontSize: 13, marginTop: 4 }]}>
                    {'\u0623\u0636\u0641 \u062E\u0635\u0627\u0626\u0635 \u0645\u062B\u0644 "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641" \u0623\u0648 "\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644" \u0644\u062A\u0638\u0647\u0631 \u0641\u064A \u0646\u0645\u0648\u0630\u062C \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0643\u0627\u0646'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
                  {state.attrDefs.map((def) => (
                    <View key={def.id} style={styles.attrDefCard}>
                      <View style={styles.attrDefHeader}>
                        <Text style={styles.attrDefLabel}>{def.label}</Text>
                        {def.is_required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredBadgeText}>{'\u0645\u0637\u0644\u0648\u0628'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.attrDefMeta}>
                        <View style={styles.attrDefChip}>
                          <Text style={styles.attrDefChipText}>
                            {'\u0627\u0644\u0645\u0641\u062A\u0627\u062D'}: {def.key}
                          </Text>
                        </View>
                        <View style={styles.attrDefChip}>
                          <Text style={styles.attrDefChipText}>
                            {'\u0627\u0644\u0646\u0648\u0639'}: {VALUE_TYPES.find((v) => v.value === def.value_type)?.label || def.value_type}
                          </Text>
                        </View>
                        <View style={styles.attrDefChip}>
                          <Text style={styles.attrDefChipText}>
                            {'\u0627\u0644\u062F\u0648\u0631'}: {parseAttrUiOptions(def.options).uiRole ?? 'dynamic'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.attrDefActions}>
                        <TouchableOpacity style={styles.attrDefEditBtn} onPress={() => state.openEditAttr(def)}>
                          <Text style={styles.attrDefEditText}>تعديل</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.attrDefDelBtn} onPress={() => state.confirmDeleteAttr(def)}>
                          <Text style={styles.attrDefDelText}>حذف</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      )}

      {/* Category Add/Edit Modal */}
      <AdminCategoryModal
        visible={state.showCategoryModal}
        isEditing={Boolean(state.editingCategory)}
        form={state.categoryForm}
        onChange={(patch) => state.setCategoryForm((prev) => ({ ...prev, ...patch }))}
        onSave={state.saveCategory}
        onClose={() => state.setShowCategoryModal(false)}
      />

      {/* Attribute Definition Add Modal */}
      <AdminAttributeModal
        visible={state.showAttrModal}
        isEditing={Boolean(state.editingAttrDef)}
        form={state.attrForm}
        onChange={(patch) => state.setAttrForm((prev) => ({ ...prev, ...patch }))}
        onSave={state.saveAttrDef}
        onClose={state.closeAttrModal}
      />
    </View>
  );
}
