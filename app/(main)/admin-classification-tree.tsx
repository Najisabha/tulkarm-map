import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AdminClassificationModal } from '../../components/admin/AdminClassificationModal';
import { AdminClassificationSectorPicker } from '../../components/admin/AdminClassificationSectorPicker';
import { adminClassificationTreeStyles as styles } from '../../components/admin/AdminClassificationTree.styles';
import { AdminClassificationTreeList } from '../../components/admin/AdminClassificationTreeList';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { useAdminClassificationTree } from '../../hooks/admin/useAdminClassificationTree';
import { useAuthStore } from '../../stores/useAuthStore';

export default function AdminClassificationTreeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sectorId?: string; placeTypeName?: string }>();
  const { user } = useAuthStore();
  const isAdmin = Boolean(user?.role === 'admin' || user?.isAdmin);

  const preset = useMemo(() => {
    const sid = params.sectorId;
    const ptn = params.placeTypeName;
    return {
      sectorId: typeof sid === 'string' ? sid : Array.isArray(sid) ? sid[0] : undefined,
      placeTypeName: typeof ptn === 'string' ? ptn : Array.isArray(ptn) ? ptn[0] : undefined,
    };
  }, [params.sectorId, params.placeTypeName]);

  const state = useAdminClassificationTree(isAdmin, preset);

  // ─── Guard ──────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <AdminSubHeader
        title={state.sectorId ? `تصنيفات ${state.selectedSector?.pluralLabel ?? ''}` : 'شجرة التصنيفات'}
        onBack={() => {
          if (state.sectorId) {
            state.setSectorId(null);
            state.setTree([]);
            return;
          }
          router.back();
        }}
        badgeText={state.sectorId && state.placeTypeId ? `${state.tree.length} رئيسي` : undefined}
      />

      {!state.sectorId ? (
        <AdminClassificationSectorPicker
          items={state.pickerItems}
          loading={state.loadingPickerItems}
          onPick={(sector) => state.setSectorId(sector.id)}
          onRefresh={state.refreshPickerItems}
        />
      ) : (
        <AdminClassificationTreeList
          loadingTree={state.loadingTree}
          refreshing={state.refreshing}
          tree={state.tree}
          allItemsFlat={state.allItemsFlat}
          onRefresh={state.onRefresh}
          onAddMain={state.openAddMain}
          onAddSub={state.openAddSub}
          onEdit={state.openEdit}
          onDelete={state.confirmDelete}
        />
      )}

      <AdminClassificationModal
        visible={state.showModal}
        editingItem={Boolean(state.editingItem)}
        hasParent={Boolean(state.modalParentId)}
        form={state.form}
        onClose={() => state.setShowModal(false)}
        onChange={(patch) => state.setForm((prev) => ({ ...prev, ...patch }))}
        onSave={state.save}
      />
    </View>
  );
}
