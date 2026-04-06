/**
 * ProductForm — نموذج إضافة/تعديل منتج.
 * يُستخدم داخل شاشة My Store.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CreateProductForm } from '../../services/productService';

interface ProductFormProps {
  initialValues?: Partial<CreateProductForm>;
  /** يُعرض على زر الإرسال */
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (form: CreateProductForm) => Promise<void>;
  onCancel?: () => void;
}

export function ProductForm({
  initialValues = {},
  submitLabel = 'حفظ المنتج',
  loading = false,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [name, setName] = useState(initialValues.name ?? '');
  const [description, setDescription] = useState(initialValues.description ?? '');
  const [price, setPrice] = useState(String(initialValues.price ?? ''));
  const [stock, setStock] = useState(String(initialValues.stock ?? ''));
  const [mainCategory, setMainCategory] = useState(initialValues.mainCategory ?? '');
  const [subCategory, setSubCategory] = useState(initialValues.subCategory ?? '');
  const [companyName, setCompanyName] = useState(initialValues.companyName ?? '');

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('تنبيه', 'اسم المنتج مطلوب'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال سعر صالح');
      return;
    }
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      price: parsedPrice,
      stock: stock ? parseInt(stock) : -1,
      mainCategory: mainCategory.trim() || null,
      subCategory: subCategory.trim() || null,
      companyName: companyName.trim() || null,
    });
  };

  return (
    <View style={styles.container}>
      <Field label="اسم المنتج" required>
        <TextInput
          style={styles.input}
          placeholder="اسم المنتج"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          textAlign="right"
        />
      </Field>

      <Field label="الوصف">
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="وصف مختصر (اختياري)"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlign="right"
        />
      </Field>

      <Field label="السعر (₪)" required>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#9CA3AF"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          textAlign="right"
        />
      </Field>

      <Field label="الكمية المتاحة (-1 = غير محدودة)">
        <TextInput
          style={styles.input}
          placeholder="-1"
          placeholderTextColor="#9CA3AF"
          value={stock}
          onChangeText={setStock}
          keyboardType="numeric"
          textAlign="right"
        />
      </Field>

      <Field label="التصنيف الرئيسي">
        <TextInput
          style={styles.input}
          placeholder="مثال: مواد غذائية"
          placeholderTextColor="#9CA3AF"
          value={mainCategory}
          onChangeText={setMainCategory}
          textAlign="right"
        />
      </Field>

      <Field label="التصنيف الفرعي">
        <TextInput
          style={styles.input}
          placeholder="مثال: مشروبات"
          placeholderTextColor="#9CA3AF"
          value={subCategory}
          onChangeText={setSubCategory}
          textAlign="right"
        />
      </Field>

      <Field label="اسم الشركة / المصنّع">
        <TextInput
          style={styles.input}
          placeholder="اختياري"
          placeholderTextColor="#9CA3AF"
          value={companyName}
          onChangeText={setCompanyName}
          textAlign="right"
        />
      </Field>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.asterisk}> *</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  fieldBlock: { marginBottom: 4 },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right' },
  asterisk: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    color: '#1F2937',
  },
  textarea: { minHeight: 70 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2E86AB',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
