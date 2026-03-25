import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { LAYOUT } from '../../constants/layout';
import { shadow } from '../../utils/shadowStyles';

interface MyStore {
  id: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
}

interface Service {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number | null;
  is_available: boolean;
}

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  main_category?: string | null;
  sub_category?: string | null;
  company_name?: string | null;
  stock: number;
  is_available: boolean;
}

interface Order {
  id: string;
  store_id: string;
  store_name: string;
  status: string;
  total: number;
  customer_name: string;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number }[];
}


export default function OwnerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stores, setStores] = useState<MyStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<MyStore | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'services' | 'products' | 'orders'>('services');
  const [showAddService, setShowAddService] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodMainCategory, setProdMainCategory] = useState('');
  const [prodSubCategory, setProdSubCategory] = useState('');
  const [prodCompanyName, setProdCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOwnerOrAdmin = user?.role === 'owner' || user?.isAdmin;

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    loadMyStores();
  }, [user]);

  const loadMyStores = async () => {
    try {
      setLoading(true);
      const res = await api.getMyStores();
      setStores(res.data || []);
      if (res.data?.length > 0) {
        setSelectedStore(res.data[0]);
      }
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadStoreData(selectedStore.id);
    }
  }, [selectedStore?.id]);

  const loadStoreData = async (storeId: string) => {
    try {
      const [svcRes, prodRes, ordRes] = await Promise.all([
        api.getStoreServices(storeId),
        api.getStoreProducts(storeId),
        api.getStoreOrders(storeId),
      ]);
      setServices(svcRes.data || []);
      setProducts(prodRes.data || []);
      setOrders(ordRes.data || []);
    } catch {
      setServices([]);
      setProducts([]);
      setOrders([]);
    }
  };

  const handleAddService = async () => {
    if (!svcName.trim()) return Alert.alert('تنبيه', 'اسم الخدمة مطلوب');
    if (!selectedStore) return;
    setSubmitting(true);
    try {
      await api.addStoreService(selectedStore.id, {
        name: svcName.trim(),
        description: svcDesc.trim() || undefined,
        price: svcPrice ? parseFloat(svcPrice) : undefined,
      });
      setSvcName(''); setSvcDesc(''); setSvcPrice('');
      setShowAddService(false);
      loadStoreData(selectedStore.id);
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProduct = async () => {
    if (!prodName.trim()) return Alert.alert('تنبيه', 'اسم المنتج مطلوب');
    if (!prodPrice.trim()) return Alert.alert('تنبيه', 'السعر مطلوب');
    if (!selectedStore) return;
    setSubmitting(true);
    try {
      await api.addStoreProduct(selectedStore.id, {
        name: prodName.trim(),
        description: prodDesc.trim() || undefined,
        price: parseFloat(prodPrice),
        stock: prodStock ? parseInt(prodStock) : -1,
        main_category: prodMainCategory.trim() || null,
        sub_category: prodSubCategory.trim() || null,
        company_name: prodCompanyName.trim() || null,
      });
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdStock('');
      setProdMainCategory('');
      setProdSubCategory('');
      setProdCompanyName('');
      setShowAddProduct(false);
      loadStoreData(selectedStore.id);
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = (svc: Service) => {
    Alert.alert('حذف', `حذف "${svc.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive',
        onPress: async () => {
          await api.deleteStoreService(svc.store_id, svc.id);
          loadStoreData(svc.store_id);
        },
      },
    ]);
  };

  const handleDeleteProduct = (prod: Product) => {
    Alert.alert('حذف', `حذف "${prod.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive',
        onPress: async () => {
          await api.deleteStoreProduct(prod.store_id, prod.id);
          loadStoreData(prod.store_id);
        },
      },
    ]);
  };

  const handleOrderStatus = (orderId: string, status: string) => {
    Alert.alert('تأكيد', `تغيير الحالة إلى ${status === 'confirmed' ? 'مؤكد' : status === 'completed' ? 'مكتمل' : 'ملغي'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        onPress: async () => {
          await api.updateOrderStatus(orderId, status);
          if (selectedStore) loadStoreData(selectedStore.id);
        },
      },
    ]);
  };

  if (!isOwnerOrAdmin) {
    return (
      <View style={s.unauthorized}>
        <Text style={s.unauthorizedIcon}>🏪</Text>
        <Text style={s.unauthorizedText}>ليس لديك متجر مسجل بعد</Text>
        <Text style={s.unauthorizedSub}>تواصل مع الإدارة لتسجيل متجرك</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.headerBack}>→</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>لوحة تحكم المتجر</Text>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>🏪 صاحب متجر</Text>
        </View>
      </View>

      {/* Store Selector */}
      {stores.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storeSelector}>
          {stores.map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[s.storeChip, selectedStore?.id === st.id && s.storeChipActive]}
              onPress={() => setSelectedStore(st)}
            >
              <Text style={[s.storeChipText, selectedStore?.id === st.id && s.storeChipTextActive]}>
                {st.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {stores.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>لا يوجد متاجر مسجلة لك</Text>
        </View>
      ) : (
        <>
          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statNum}>{services.length}</Text>
              <Text style={s.statLabel}>خدمات</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNum}>{products.length}</Text>
              <Text style={s.statLabel}>منتجات</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNum}>{orders.filter((o) => o.status === 'pending').length}</Text>
              <Text style={s.statLabel}>طلبات جديدة</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            {(['services', 'products', 'orders'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.tab, tab === t && s.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'services' ? '🛎️ الخدمات' : t === 'products' ? '📦 المنتجات' : '🧾 الطلبات'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <ScrollView style={s.content} contentContainerStyle={s.contentPadding}>
            {tab === 'services' && (
              <>
                <TouchableOpacity style={s.addBtn} onPress={() => setShowAddService(true)}>
                  <Text style={s.addBtnText}>+ إضافة خدمة</Text>
                </TouchableOpacity>
                {services.length === 0 ? (
                  <Text style={s.noItems}>لا توجد خدمات مضافة بعد</Text>
                ) : services.map((svc) => (
                  <View key={svc.id} style={s.card}>
                    <View style={s.cardHeader}>
                      <TouchableOpacity onPress={() => handleDeleteService(svc)}>
                        <Text style={s.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                      <Text style={s.cardTitle}>{svc.name}</Text>
                    </View>
                    {svc.description && <Text style={s.cardDesc}>{svc.description}</Text>}
                    {svc.price != null && (
                      <Text style={s.cardPrice}>💰 {svc.price} ₪</Text>
                    )}
                  </View>
                ))}
              </>
            )}

            {tab === 'products' && (
              <>
                <TouchableOpacity style={s.addBtn} onPress={() => setShowAddProduct(true)}>
                  <Text style={s.addBtnText}>+ إضافة منتج</Text>
                </TouchableOpacity>
                {products.length === 0 ? (
                  <Text style={s.noItems}>لا توجد منتجات مضافة بعد</Text>
                ) : products.map((prod) => (
                  <View key={prod.id} style={s.card}>
                    <View style={s.cardHeader}>
                      <TouchableOpacity onPress={() => handleDeleteProduct(prod)}>
                        <Text style={s.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                      <Text style={s.cardTitle}>{prod.name}</Text>
                    </View>
                    {prod.description && <Text style={s.cardDesc}>{prod.description}</Text>}
                    <View style={s.cardFooter}>
                      <Text style={s.cardPrice}>💰 {prod.price} ₪</Text>
                      {prod.stock !== -1 && <Text style={s.cardStock}>المخزون: {prod.stock}</Text>}
                    </View>
                    {(prod.main_category || prod.sub_category || prod.company_name) ? (
                      <View style={{ marginTop: 8 }}>
                        {prod.company_name ? (
                          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '700', textAlign: 'right' }}>
                            🏢 {prod.company_name}
                          </Text>
                        ) : null}
                        {prod.main_category ? (
                          <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '700', textAlign: 'right' }}>
                            📚 {prod.main_category}{prod.sub_category ? ` / ${prod.sub_category}` : ''}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={{
                        marginTop: 12,
                        backgroundColor: prod.is_available ? '#DCFCE7' : '#FEF2F2',
                        borderRadius: 10,
                        paddingVertical: 10,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: prod.is_available ? '#86EFAC' : '#FECACA',
                      }}
                      onPress={async () => {
                        setSubmitting(true);
                        try {
                          await api.updateStoreProduct(selectedStore?.id ?? prod.store_id, prod.id, {
                            is_available: !prod.is_available,
                          });
                          if (selectedStore) loadStoreData(selectedStore.id);
                          else loadStoreData(prod.store_id);
                        } catch (e: any) {
                          Alert.alert('خطأ', e?.message || 'فشل تحديث حالة المنتج');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151' }}>
                        {prod.is_available ? 'مفعّل' : 'مخفي'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {tab === 'orders' && (
              <>
                {orders.length === 0 ? (
                  <Text style={s.noItems}>لا توجد طلبات بعد</Text>
                ) : orders.map((order) => (
                  <View key={order.id} style={s.card}>
                    <View style={s.cardHeader}>
                      <View style={[s.statusBadge, {
                        backgroundColor: order.status === 'pending' ? '#FEF3C7' :
                          order.status === 'confirmed' ? '#DBEAFE' :
                          order.status === 'completed' ? '#DCFCE7' : '#FEE2E2',
                      }]}>
                        <Text style={[s.statusText, {
                          color: order.status === 'pending' ? '#92400E' :
                            order.status === 'confirmed' ? '#1E40AF' :
                            order.status === 'completed' ? '#166534' : '#991B1B',
                        }]}>
                          {order.status === 'pending' ? 'جديد' :
                            order.status === 'confirmed' ? 'مؤكد' :
                            order.status === 'completed' ? 'مكتمل' : 'ملغي'}
                        </Text>
                      </View>
                      <Text style={s.cardTitle}>طلب من {order.customer_name}</Text>
                    </View>
                    {order.items?.map((item, idx) => (
                      <Text key={idx} style={s.orderItem}>
                        {item.product_name} × {item.quantity} = {(item.unit_price * item.quantity).toFixed(2)} ₪
                      </Text>
                    ))}
                    <Text style={s.orderTotal}>المجموع: {parseFloat(String(order.total)).toFixed(2)} ₪</Text>
                    {order.status === 'pending' && (
                      <View style={s.orderActions}>
                        <TouchableOpacity style={s.confirmBtn} onPress={() => handleOrderStatus(order.id, 'confirmed')}>
                          <Text style={s.confirmBtnText}>✅ تأكيد</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => handleOrderStatus(order.id, 'cancelled')}>
                          <Text style={s.cancelBtnText}>❌ رفض</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {order.status === 'confirmed' && (
                      <TouchableOpacity style={s.completeBtn} onPress={() => handleOrderStatus(order.id, 'completed')}>
                        <Text style={s.completeBtnText}>✅ إكمال الطلب</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Add Service Modal */}
      <Modal visible={showAddService} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>إضافة خدمة</Text>
              <TouchableOpacity onPress={() => setShowAddService(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="اسم الخدمة *" value={svcName} onChangeText={setSvcName} textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput style={[s.input, s.textarea]} placeholder="وصف الخدمة" value={svcDesc} onChangeText={setSvcDesc} multiline textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput style={s.input} placeholder="السعر (اختياري)" value={svcPrice} onChangeText={setSvcPrice} keyboardType="decimal-pad" textAlign="right" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleAddService} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>إضافة</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={showAddProduct} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>إضافة منتج</Text>
              <TouchableOpacity onPress={() => setShowAddProduct(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="اسم المنتج *" value={prodName} onChangeText={setProdName} textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput style={[s.input, s.textarea]} placeholder="وصف المنتج" value={prodDesc} onChangeText={setProdDesc} multiline textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput style={s.input} placeholder="السعر *" value={prodPrice} onChangeText={setProdPrice} keyboardType="decimal-pad" textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput style={s.input} placeholder="المخزون (فارغ = غير محدود)" value={prodStock} onChangeText={setProdStock} keyboardType="number-pad" textAlign="right" placeholderTextColor="#9CA3AF" />
            <TextInput
              style={s.input}
              placeholder="الصنف الرئيسي (اختياري)"
              value={prodMainCategory}
              onChangeText={setProdMainCategory}
              textAlign="right"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={s.input}
              placeholder="الصنف الفرعي (اختياري)"
              value={prodSubCategory}
              onChangeText={setProdSubCategory}
              textAlign="right"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={s.input}
              placeholder="اسم الشركة (اختياري)"
              value={prodCompanyName}
              onChangeText={setProdCompanyName}
              textAlign="right"
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleAddProduct} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>إضافة</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EEF2' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EEF2' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EEF2', padding: 20 },
  unauthorizedIcon: { fontSize: 64, marginBottom: 16 },
  unauthorizedText: { fontSize: 20, fontWeight: '700', color: '#1A3A5C', marginBottom: 8 },
  unauthorizedSub: { fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  backBtn: { backgroundColor: '#2E86AB', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  header: {
    backgroundColor: '#1A3A5C', paddingTop: LAYOUT.headerTop, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerBack: { color: '#fff', fontSize: 22 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerBadge: { backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  storeSelector: { maxHeight: 50, paddingHorizontal: 12, paddingVertical: 8 },
  storeChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  storeChipActive: { backgroundColor: '#2E86AB', borderColor: '#2E86AB' },
  storeChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  storeChipTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center',
    ...shadow({ offset: { width: 0, height: 2 }, opacity: 0.1, radius: 8, elevation: 4 }),
  },
  statNum: { fontSize: 28, fontWeight: '800', color: '#2E86AB' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  tabActive: { backgroundColor: '#2E86AB', borderColor: '#2E86AB' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 40 },
  addBtn: {
    backgroundColor: '#2E86AB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 16,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 3 }, opacity: 0.25, radius: 8, elevation: 4 }),
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  noItems: { textAlign: 'center', color: '#9CA3AF', fontSize: 15, marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.08, radius: 6, elevation: 3 }),
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', flex: 1, textAlign: 'right' },
  deleteIcon: { fontSize: 18, padding: 4 },
  cardDesc: { fontSize: 14, color: '#6B7280', textAlign: 'right', marginBottom: 6 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: '#10B981', textAlign: 'right' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStock: { fontSize: 13, color: '#6B7280' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderItem: { fontSize: 14, color: '#374151', textAlign: 'right', marginBottom: 2 },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#1A3A5C', textAlign: 'right', marginTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8 },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  confirmBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#EF4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
  completeBtn: { backgroundColor: '#2E86AB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  completeBtnText: { color: '#fff', fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A3A5C' },
  modalClose: { fontSize: 24, color: '#6B7280' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1.5, borderColor: '#E5E7EB', color: '#1F2937' },
  textarea: { minHeight: 80 },
  submitBtn: {
    backgroundColor: '#2E86AB', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 4 }),
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
