import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useStores, Store } from '../../context/StoreContext';
import { useCategories } from '../../context/CategoryContext';
import { AddPlaceModal } from '../../components/AddPlaceModal';
import { TULKARM_BOUNDS, TULKARM_REGION } from '../../utils/geofencing.web';
import { shadow } from '../../utils/shadowStyles';
import { useRouter } from 'expo-router';

function getCategoryStyle(cats: { name: string; emoji: string; color: string }[], name: string) {
  const c = cats.find((x) => x.name === name);
  return { emoji: c?.emoji ?? '📍', color: c?.color ?? '#2E86AB' };
}

export default function MapScreenWeb() {
  const { user, logout } = useAuth();
  const { categories: categoryList } = useCategories();
  const { stores, addPlaceRequest, deleteStore } = useStores();
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);

  const categories = Array.from(new Set(stores.map((s) => s.category)));
  const categoryStores = stores.filter((s) => s.category === selectedCategory);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    TULKARM_BOUNDS.minLng
  }%2C${TULKARM_BOUNDS.minLat}%2C${TULKARM_BOUNDS.maxLng}%2C${
    TULKARM_BOUNDS.maxLat
  }&layer=mapnik&marker=${TULKARM_REGION.latitude}%2C${TULKARM_REGION.longitude}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setShowSidebar(true)}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle}>🏙️ طولكرم</Text>
          <Text style={styles.headerSubtitle}>دليل المتاجر</Text>
        </View>
        {user?.isAdmin && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push('/(main)/admin')}
          >
            <Text style={styles.adminButtonText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Web notice */}
      <View style={styles.webNotice}>
        <Text style={styles.webNoticeText}>
          📱 للحصول على خرائط تفاعلية وإشعارات الدخول/الخروج، استخدم تطبيق الموبايل
        </Text>
      </View>

      {/* Suggest place button */}
      <TouchableOpacity
        style={styles.suggestPlaceBtn}
        onPress={() => setShowAddPlaceModal(true)}
      >
        <Text style={styles.suggestPlaceBtnText}>➕ اقترح مكاناً</Text>
      </TouchableOpacity>

      {showAddPlaceModal && (
        <AddPlaceModal
          visible={showAddPlaceModal}
          onClose={() => setShowAddPlaceModal(false)}
          onSubmit={async (data) => {
            await addPlaceRequest(data);
            setShowAddPlaceModal(false);
          }}
          latitude={TULKARM_REGION.latitude}
          longitude={TULKARM_REGION.longitude}
        />
      )}

      {/* OpenStreetMap Embed */}
      <View style={styles.mapContainer}>
        <iframe
          src={osmUrl}
          style={{ border: 0, width: '100%', height: '100%' }}
          title="Tulkarm Map"
        />
      </View>

      {/* Category Bar */}
      <View style={styles.storesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
          {categories.map((cat) => {
            const count = stores.filter((s) => s.category === cat).length;
            const active = selectedCategory === cat;
            const color = getCategoryStyle(categoryList, cat).color;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  active && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setSelectedCategory(active ? null : cat)}
              >
                <Text style={styles.categoryChipEmoji}>{getCategoryStyle(categoryList, cat).emoji}</Text>
                <Text style={[styles.categoryChipText, active && { color: '#fff' }]}>{cat}</Text>
                <View style={[styles.categoryChipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : color + '22' }]}>
                  <Text style={[styles.categoryChipBadgeText, { color: active ? '#fff' : color }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Category Sheet */}
      <Modal visible={!!selectedCategory} transparent animationType="slide" onRequestClose={() => setSelectedCategory(null)}>
        <TouchableOpacity style={styles.sheetOverlay} onPress={() => setSelectedCategory(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSelectedCategory(null)}>
              <Text style={styles.sheetCloseBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <Text style={{ fontSize: 28 }}>{getCategoryStyle(categoryList, selectedCategory ?? '').emoji}</Text>
              <View>
                <Text style={styles.sheetTitle}>{selectedCategory}</Text>
                <Text style={styles.sheetSubtitle}>{categoryStores.length} مكان</Text>
              </View>
            </View>
          </View>
          <ScrollView style={styles.sheetList}>
            {categoryStores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={styles.catStoreItem}
                onPress={() => { setSelectedCategory(null); setSelectedStore(store); }}
              >
                <View style={styles.catStoreInfo}>
                  <Text style={styles.catStoreName}>{store.name}</Text>
                  <Text style={styles.catStoreDesc}>{store.description}</Text>
                  {store.phone ? <Text style={styles.catStorePhone}>📞 {store.phone}</Text> : null}
                </View>
                <Text style={{ fontSize: 26, marginLeft: 12 }}>{getCategoryStyle(categoryList, store.category).emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Sidebar */}
      <Modal visible={showSidebar} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowSidebar(false)} />
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'م'}</Text>
            </View>
            <Text style={styles.sidebarName}>{user?.name}</Text>
            <Text style={styles.sidebarEmail}>{user?.id === 'guest' ? 'دخول كضيف' : user?.email}</Text>
            {user?.isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>مدير النظام 👑</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.storesList}>
            <Text style={styles.storesListTitle}>المتاجر ({stores.length})</Text>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={styles.storeItem}
                onPress={() => {
                  setSelectedStore(store);
                  setShowSidebar(false);
                }}
              >
                <Text style={styles.storeItemEmoji}>{getCategoryStyle(categoryList, store.category).emoji}</Text>
                <View style={styles.storeItemInfo}>
                  <Text style={styles.storeItemName}>{store.name}</Text>
                  <Text style={styles.storeItemCategory}>{store.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {user?.isAdmin && (
            <TouchableOpacity
              style={styles.sidebarAdminBtn}
              onPress={() => { setShowSidebar(false); router.push('/(main)/admin'); }}
            >
              <Text style={styles.sidebarAdminBtnText}>⚙️ لوحة الإدارة</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>🚪 تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Store Detail Modal */}
      <Modal visible={!!selectedStore} transparent animationType="slide">
        <TouchableOpacity style={styles.storeModalOverlay} onPress={() => setSelectedStore(null)} />
        {selectedStore && (
          <View style={styles.storeModal}>
            <View style={[styles.storeModalHeader, { backgroundColor: getCategoryStyle(categoryList, selectedStore.category).color }]}>
              <Text style={styles.storeModalEmoji}>{getCategoryStyle(categoryList, selectedStore.category).emoji}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedStore(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.storeModalBody}>
              <Text style={styles.storeModalName}>{selectedStore.name}</Text>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{selectedStore.category}</Text>
              </View>
              <Text style={styles.storeModalDesc}>{selectedStore.description}</Text>
              {selectedStore.phone && (
                <Text style={styles.storePhone}>📞 {selectedStore.phone}</Text>
              )}
              <Text style={styles.storeCoords}>
                📌 {selectedStore.latitude.toFixed(4)}, {selectedStore.longitude.toFixed(4)}
              </Text>
              {user?.isAdmin && (
                <View style={styles.storeModalActions}>
                  <TouchableOpacity
                    style={styles.storeModalEditBtn}
                    onPress={() => {
                      setSelectedStore(null);
                      router.push({ pathname: '/(main)/admin', params: { editStoreId: selectedStore.id } });
                    }}
                  >
                    <Text style={styles.storeModalEditBtnText}>✏️ تعديل البيانات</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.storeModalDeleteBtn}
                    onPress={() => {
                      Alert.alert(
                        'حذف المتجر',
                        `هل أنت متأكد من حذف "${selectedStore.name}"؟`,
                        [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: async () => {
                              await deleteStore(selectedStore.id);
                              setSelectedStore(null);
                              Alert.alert('تم', 'تم حذف المتجر');
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.storeModalDeleteBtnText}>🗑️ حذف المتجر</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    backgroundColor: '#1A3A5C',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  menuIcon: { color: '#fff', fontSize: 20 },
  titleBlock: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  adminButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  adminButtonText: { fontSize: 20 },
  webNotice: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  webNoticeText: { color: '#92400E', fontSize: 12, textAlign: 'center' },
  mapContainer: { flex: 1, minHeight: 300 },
  suggestPlaceBtn: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    zIndex: 10,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 4 }),
  },
  suggestPlaceBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  storesSection: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  storesSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A3A5C', marginBottom: 10, textAlign: 'right' },
  storesScroll: {},
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3F4F6', borderRadius: 22, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  categoryChipEmoji: { fontSize: 17 },
  categoryChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  categoryChipBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  categoryChipBadgeText: { fontSize: 12, fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 10,
  },
  sheetHeader: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center',
  },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  sheetCloseBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1A3A5C', textAlign: 'right' },
  sheetSubtitle: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  sheetList: { padding: 16 },
  catStoreItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  catStoreInfo: { flex: 1, alignItems: 'flex-end' },
  catStoreName: { fontSize: 15, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
  catStoreDesc: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 3 },
  catStorePhone: { fontSize: 12, color: '#4A7FA5', marginTop: 3 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sidebar: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '80%',
    backgroundColor: '#fff',
    ...shadow({ offset: { width: -4, height: 0 }, opacity: 0.2, radius: 12, elevation: 20 }),
  },
  sidebarHeader: {
    backgroundColor: '#2E86AB', padding: 24, paddingTop: 48, alignItems: 'center',
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { fontSize: 24, color: '#fff', fontWeight: '700' },
  sidebarName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sidebarEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  adminBadge: {
    backgroundColor: '#F59E0B', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
  },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  storesList: { flex: 1, padding: 16 },
  storesListTitle: { fontSize: 14, fontWeight: '700', color: '#1A3A5C', marginBottom: 10, textAlign: 'right' },
  storeItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  storeItemEmoji: { fontSize: 22, marginLeft: 10 },
  storeItemInfo: { flex: 1, alignItems: 'flex-end' },
  storeItemName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  storeItemCategory: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sidebarAdminBtn: {
    margin: 16, marginBottom: 8,
    backgroundColor: '#1A3A5C', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  sidebarAdminBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    margin: 16, marginTop: 8,
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  logoutBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  storeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  storeModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  storeModalHeader: {
    height: 100, alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  storeModalEmoji: { fontSize: 48 },
  closeBtn: {
    position: 'absolute', top: 12, left: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  storeModalBody: { padding: 24, alignItems: 'flex-end' },
  storeModalName: { fontSize: 22, fontWeight: '800', color: '#1A3A5C', textAlign: 'right', marginBottom: 8 },
  categoryPill: {
    backgroundColor: '#EBF5FB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12,
  },
  categoryPillText: { color: '#2E86AB', fontSize: 13, fontWeight: '600' },
  storeModalDesc: { fontSize: 15, color: '#4B5563', textAlign: 'right', lineHeight: 22, marginBottom: 12 },
  storePhone: { fontSize: 15, color: '#374151', fontWeight: '600', marginBottom: 6 },
  storeCoords: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  storeModalActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch', justifyContent: 'flex-start' },
  storeModalEditBtn: {
    flex: 1, backgroundColor: '#2E86AB', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  storeModalEditBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  storeModalDeleteBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  storeModalDeleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});
