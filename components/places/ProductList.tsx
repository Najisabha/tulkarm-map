/**
 * ProductList — قائمة منتجات مكان مع إمكانية الحذف والتفعيل/التعطيل.
 */

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Product } from '../../services/productService';

interface ProductListProps {
  products: Product[];
  loading?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  emptyMessage?: string;
}

export function ProductList({
  products,
  loading = false,
  onEdit,
  onDelete,
  emptyMessage = 'لا توجد منتجات',
}: ProductListProps) {
  const handleDelete = (product: Product) => {
    Alert.alert('حذف المنتج', `هل تريد حذف "${product.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => onDelete?.(product) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E86AB" />
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.price}>{item.price.toFixed(2)} ₪</Text>
              {item.mainCategory ? (
                <Text style={styles.category}>{item.mainCategory}</Text>
              ) : null}
              <Text style={[styles.badge, item.isAvailable ? styles.badgeActive : styles.badgeInactive]}>
                {item.isAvailable ? 'متاح' : 'غير متاح'}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            {onEdit && (
              <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
                <Text style={styles.editBtnText}>تعديل</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>حذف</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'right', marginBottom: 2 },
  productDesc: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginBottom: 6 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  price: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  category: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeActive: { backgroundColor: '#DCFCE7', color: '#15803D' },
  badgeInactive: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  cardActions: { gap: 8 },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});
