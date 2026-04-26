import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { AuthUser } from '../../stores/useAuthStore';
import { getCategoryStyle, type Store } from '../../utils/map/storeModel';
import { mapStyles as styles } from './styles';

interface MapSidebarProps {
  user: AuthUser | null;
  categories: string[];
  stores: Store[];
  categoryList: { name: string; emoji: string; color: string }[];
  onClose: () => void;
  onPickCategory: (category: string) => void;
  onOpenAdmin: () => void;
  onOpenUserModifications: () => void;
  onLogout: () => void;
}

export function MapSidebar({
  user,
  categories,
  stores,
  categoryList,
  onClose,
  onPickCategory,
  onOpenAdmin,
  onOpenUserModifications,
  onLogout,
}: MapSidebarProps) {
  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <TouchableOpacity style={styles.overlayBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <View style={styles.avatarCircle}>
            {user?.profileImageUrl ? (
              <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'م'}</Text>
            )}
          </View>
          <Text style={styles.sidebarName}>{user?.name}</Text>
          <Text style={styles.sidebarEmail}>
            {user?.id === 'guest' ? 'دخول كضيف' : user?.email}
          </Text>
          {user?.isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>مدير النظام 👑</Text>
            </View>
          )}
        </View>

        <ScrollView style={styles.sidebarList}>
          <Text style={styles.sidebarSectionTitle}>الفئات ({categories.length})</Text>
          <View style={styles.sidebarCatGrid}>
            {categories.map((cat) => {
              const catCount = stores.filter((s) => s.category === cat).length;
              const { color, emoji } = getCategoryStyle(categoryList, cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={styles.sidebarCatItem}
                  onPress={() => onPickCategory(cat)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sidebarCatEmoji}>{emoji}</Text>
                  <Text style={styles.sidebarCatName} numberOfLines={1}>
                    {cat}
                  </Text>
                  <View style={[styles.sidebarCatCount, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.sidebarCatCountText, { color }]}>{catCount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {user?.isAdmin && (
          <TouchableOpacity style={styles.sidebarAdminBtn} onPress={onOpenAdmin}>
            <Text style={styles.sidebarAdminBtnText}>⚙️ لوحة الإدارة</Text>
          </TouchableOpacity>
        )}
        {user && user.id !== 'guest' && (
          <TouchableOpacity style={styles.sidebarUserModBtn} onPress={onOpenUserModifications}>
            <Text style={styles.sidebarUserModBtnText}>🛠️ تعديلات</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>🚪 تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
