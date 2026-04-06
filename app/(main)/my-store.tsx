/**
 * MyStore — شاشة صاحب المتجر (store_owner / owner)
 * تعرض متاجره ومنتجاته وخدماته.
 * الأدوار المسموحة: owner, store_owner
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import { ProductForm } from '../../components/places/ProductForm';
import { ProductList } from '../../components/places/ProductList';
import { LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { useProductsStore } from '../../stores/useProductsStore';
import { shadow } from '../../utils/shadowStyles';
import { Product } from '../../services/productService';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  status?: string;
}

export default function MyStoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { products, loading: productsLoading, loadByPlace, createProduct, updateProduct, deleteProduct } = useProductsStore();

  const [myStores, setMyStores] = useState<StoreItem[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // الحراسة: فقط owner/store_owner
  useEffect(() => {
    if (!user) return;
    const role = user.role;
    if (role !== 'owner' && role !== 'store_owner' && role !== 'admin') {
      Alert.alert('تنبيه', 'هذه الشاشة مخصصة لأصحاب المتاجر فقط');
      router.back();
    }
  }, [user]);

  const loadMyStores = useCallback(async () => {
    if (!user?.id || user.id === 'guest') return;
    setLoadingStores(true);
    try {
      const res = await api.getPlaces({ status: 'active', limit: 100 });
      const all = res.data ?? [];
      // تصفية الأماكن التي أنشأها هذا المستخدم
      const mine = all
        .filter((p: any) => p.created_by === user.id || p.owner_id === user.id)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          category: p.type_name || '',
          latitude: p.latitude,
          longitude: p.longitude,
          status: p.status,
        }));
      setMyStores(mine);
      if (mine.length > 0 && !selectedStore) {
        setSelectedStore(mine[0]);
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل تحميل المتاجر');
    } finally {
      setLoadingStores(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadMyStores(); }, [loadMyStores]);

  useEffect(() => {
    if (selectedStore) {
      void loadByPlace(selectedStore.id);
    }
  }, [selectedStore?.id]);

  const handleSaveProduct = async (form: any) => {
    if (!selectedStore) return;
    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduct(selectedStore.id, editingProduct.id, form);
      } else {
        await createProduct(selectedStore.id, form);
      }
      setShowProductForm(false);
      setEditingProduct(null);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل حفظ المنتج');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!selectedStore) return;
    try {
      await deleteProduct(selectedStore.id, product.id);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل حذف المنتج');
    }
  };

  if (loadingStores) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>جارٍ تحميل متاجرك…</Text>
      </View>
    );
  }

  if (myStores.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🏪</Text>
        <Text style={styles.emptyTitle}>لا توجد متاجر</Text>
        <Text style={styles.emptySubtext}>
          لم يتم ربط أي متجر بحسابك بعد. أضف مكانك من الخريطة وسيظهر هنا بعد الموافقة.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>العودة للخريطة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>متجري</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* قائمة المتاجر (إذا أكثر من متجر) */}
      {myStores.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeTabs}
        >
          {myStores.map((store) => (
            <TouchableOpacity
              key={store.id}
              style={[styles.storeTab, selectedStore?.id === store.id && styles.storeTabActive]}
              onPress={() => setSelectedStore(store)}
            >
              <Text
                style={[styles.storeTabText, selectedStore?.id === store.id && styles.storeTabTextActive]}
                numberOfLines={1}
              >
                {store.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* معلومات المتجر المختار */}
      {selectedStore && (
        <View style={styles.storeCard}>
          <Text style={styles.storeName}>{selectedStore.name}</Text>
          <Text style={styles.storeCategory}>{selectedStore.category}</Text>
          {selectedStore.description ? (
            <Text style={styles.storeDesc} numberOfLines={2}>{selectedStore.description}</Text>
          ) : null}
        </View>
      )}

      {/* قسم المنتجات */}
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          style={styles.addProductBtn}
          onPress={() => { setEditingProduct(null); setShowProductForm(true); }}
        >
          <Text style={styles.addProductBtnText}>+ إضافة منتج</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>المنتجات</Text>
      </View>

      <View style={styles.listContainer}>
        <ProductList
          products={products}
          loading={productsLoading}
          onEdit={(product) => { setEditingProduct(product); setShowProductForm(true); }}
          onDelete={handleDeleteProduct}
          emptyMessage="لا توجد منتجات في هذا المتجر بعد"
        />
      </View>

      {/* مودال نموذج المنتج */}
      <Modal
        visible={showProductForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowProductForm(false); setEditingProduct(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </Text>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <ProductForm
                initialValues={editingProduct ? {
                  name: editingProduct.name,
                  description: editingProduct.description ?? undefined,
                  price: editingProduct.price,
                  stock: editingProduct.stock,
                  mainCategory: editingProduct.mainCategory,
                  subCategory: editingProduct.subCategory,
                  companyName: editingProduct.companyName,
                } : {}}
                submitLabel={editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                loading={savingProduct}
                onSubmit={handleSaveProduct}
                onCancel={() => { setShowProductForm(false); setEditingProduct(null); }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 14, fontSize: 15, color: '#6B7280' },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A3A5C', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  backBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: (LAYOUT?.STATUS_BAR_HEIGHT ?? 44) + 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    ...shadow({ color: '#000', offset: { width: 0, height: 2 }, opacity: 0.06, radius: 6, elevation: 3 }),
  },
  backArrow: { padding: 8 },
  backArrowText: { fontSize: 22, color: '#2E86AB', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A3A5C' },
  storeTabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  storeTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  storeTabActive: { backgroundColor: '#2E86AB', borderColor: '#2E86AB' },
  storeTabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  storeTabTextActive: { color: '#fff' },
  storeCard: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...shadow({ color: '#000', offset: { width: 0, height: 2 }, opacity: 0.05, radius: 6, elevation: 2 }),
  },
  storeName: { fontSize: 18, fontWeight: '800', color: '#1A3A5C', textAlign: 'right', marginBottom: 4 },
  storeCategory: { fontSize: 13, color: '#2E86AB', fontWeight: '600', textAlign: 'right', marginBottom: 4 },
  storeDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', lineHeight: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A3A5C' },
  addProductBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addProductBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  listContainer: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A3A5C' },
  modalClose: { fontSize: 22, color: '#6B7280' },
  modalBody: { padding: 20, paddingBottom: 40 },
});
