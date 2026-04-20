import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingBlock } from '../../components/admin/AdminLoadingBlock';
import { AdminSearchBar } from '../../components/admin/AdminSearchBar';
import { AdminSubHeader } from '../../components/admin/AdminSubHeader';
import { AdminUnauthorized } from '../../components/admin/AdminUnauthorized';
import { AdminUserCard } from '../../components/admin/AdminUserCard';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { adminUsersStyles as styles } from '../../components/admin/AdminUsers.styles';
import { useAdminUsers } from '../../hooks/admin/useAdminUsers';
import { useAuthPlacesBootstrap } from '../../hooks/useAuthPlacesBootstrap';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePlacesStore } from '../../stores/usePlacesStore';
import { isDefaultAdminEmail, userBadgeCount } from '../../utils/admin/userHelpers';

export default function AdminUsersScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, init } = useAuthStore();
  const { loadAll } = usePlacesStore();

  /** توحيد التهيئة مع بقية شاشات الإدارة/الخريطة */
  useAuthPlacesBootstrap({ init, loadAll, forceAdmin: true });

  const usersState = useAdminUsers({ isAdmin: !!user?.isAdmin, authLoading });

  if (authLoading) {
    return <AdminLoadingBlock fullPage message="جاري التحميل..." />;
  }

  if (!user?.isAdmin) {
    return <AdminUnauthorized onBackToMap={() => router.back()} />;
  }

  return (
    <View style={styles.container}>
      <AdminSubHeader
        title="إدارة المستخدمين"
        badgeText={userBadgeCount(usersState.users.length)}
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <AdminSearchBar
          value={usersState.searchQuery}
          onChange={usersState.setSearchQuery}
          placeholder="بحث بالاسم أو البريد..."
        />

        {usersState.loading ? (
          <AdminLoadingBlock />
        ) : usersState.loadError ? (
          <AdminErrorState message={usersState.loadError} onRetry={usersState.loadUsers} />
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {usersState.filteredUsers.map((u) => (
              <AdminUserCard
                key={u.id}
                user={u}
                isDefaultAdmin={isDefaultAdminEmail(u.email)}
                onEdit={usersState.openEdit}
                onToggleAdmin={usersState.toggleAdmin}
                onDelete={usersState.handleDelete}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <EditUserModal
        visible={!!usersState.editUser}
        user={usersState.editUser}
        name={usersState.editName}
        email={usersState.editEmail}
        saving={usersState.savingEdit}
        onChangeName={usersState.setEditName}
        onChangeEmail={usersState.setEditEmail}
        onClose={usersState.closeEdit}
        onSave={usersState.saveEdit}
      />
    </View>
  );
}
