import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { api } from '../api/client';

const REASONS = [
  { id: 'wrong_info', label: 'معلومات خاطئة' },
  { id: 'closed', label: 'المكان مغلق' },
  { id: 'duplicate', label: 'تكرار' },
  { id: 'inappropriate', label: 'محتوى غير لائق' },
  { id: 'other', label: 'أخرى' },
];

interface ReportModalProps {
  visible: boolean;
  storeId: string;
  storeName: string;
  onClose: () => void;
}

export function ReportModal({ visible, storeId, storeName, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert('تنبيه', 'اختر سبب الإبلاغ');
      return;
    }
    setSubmitting(true);
    try {
      await api.addReport({ placeId: storeId, reason, details: details.trim() || undefined });
      Alert.alert('✅ تم', 'تم إرسال الإبلاغ بنجاح');
      setReason('');
      setDetails('');
      onClose();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الإرسال');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setDetails('');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>الإبلاغ عن "{storeName}"</Text>
          <Text style={styles.label}>سبب الإبلاغ</Text>
          <View style={styles.reasonRow}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonChip, reason === r.id && styles.reasonChipActive]}
                onPress={() => setReason(r.id)}
              >
                <Text style={[styles.reasonText, reason === r.id && styles.reasonTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>تفاصيل (اختياري)</Text>
          <TextInput
            style={styles.input}
            placeholder="أضف تفاصيل إن وجدت"
            placeholderTextColor="#9CA3AF"
            value={details}
            onChangeText={setDetails}
            multiline
            textAlign="right"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>{submitting ? 'جاري الإرسال...' : 'إرسال'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'right' },
  reasonRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  reasonChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reasonChipActive: { backgroundColor: '#2E86AB' },
  reasonText: { fontSize: 13, color: '#374151' },
  reasonTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 60,
    marginBottom: 16,
  },
  actions: { flexDirection: 'row-reverse', gap: 12 },
  submitBtn: { flex: 1, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
});
