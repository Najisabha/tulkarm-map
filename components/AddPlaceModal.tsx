import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { shadow } from '../utils/shadowStyles';
import { useCategories } from '../context/CategoryContext';

const MAX_PHOTOS = 3;
const MAX_VIDEOS = 1;

interface AddPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    category: string;
    phone: string;
    latitude: number;
    longitude: number;
    photos?: string[];
    videos?: string[];
  }) => Promise<void>;
  latitude: number;
  longitude: number;
}

export function AddPlaceModal({
  visible,
  onClose,
  onSubmit,
  latitude,
  longitude,
}: AddPlaceModalProps) {
  const { categories } = useCategories();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '');

  useEffect(() => {
    if (categories.length > 0) {
      setCategory((prev) => (prev.trim() ? prev : categories[0].name));
    }
  }, [categories]);

  const [phone, setPhone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setCategory(categories[0]?.name ?? '');
    setPhone('');
    setPhotos([]);
    setVideos([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('تنبيه', `الحد الأقصى ${MAX_PHOTOS} صور`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'نحتاج إذن الوصول للصور');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((p) => [...p, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const pickVideo = async () => {
    if (videos.length >= MAX_VIDEOS) {
      Alert.alert('تنبيه', `الحد الأقصى ${MAX_VIDEOS} فيديو`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'نحتاج إذن الوصول للملفات');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets[0]) {
      setVideos((v) => [...v, result.assets[0].uri].slice(0, MAX_VIDEOS));
    }
  };

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));
  const removeVideo = (idx: number) => setVideos((v) => v.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة الاسم والوصف');
      return;
    }
    if (!category.trim() || categories.length === 0) {
      Alert.alert('تنبيه', 'لا توجد فئات. يرجى طلب المدير إضافة فئات أولاً.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        category,
        phone: phone.trim(),
        latitude,
        longitude,
        photos: photos.length ? photos : undefined,
        videos: videos.length ? videos : undefined,
      });
      Alert.alert('✅ تم', 'تم إرسال طلب إضافة المكان للأدمن');
      handleClose();
    } catch (e) {
      Alert.alert('خطأ', 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>إضافة مكان</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.coords}>📌 {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>

            <Text style={styles.label}>الاسم *</Text>
            <TextInput
              style={styles.input}
              placeholder="اسم المكان"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
              textAlign="right"
            />

            <Text style={styles.label}>الوصف *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="وصف مختصر"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlign="right"
            />

            <Text style={styles.label}>الفئة</Text>
            {categories.length === 0 ? (
              <Text style={styles.emptyCategoriesText}>لا توجد فئات. يرجى طلب المدير إضافة فئات أولاً.</Text>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catRow}
              contentContainerStyle={styles.catRowContent}
            >
              {[...categories]
                .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                .map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, category === c.name && [styles.catChipActive, { backgroundColor: c.color }]]}
                  onPress={() => setCategory(c.name)}
                >
                  <Text style={[styles.catText, category === c.name && { color: '#fff' }]}>
                    {c.emoji} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            )}

            <Text style={styles.label}>رقم الهاتف</Text>
            <TextInput
              style={styles.input}
              placeholder="05xxxxxxxx"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />

            <Text style={styles.label}>صور ({photos.length}/{MAX_PHOTOS})</Text>
            <View style={styles.mediaRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.removeThumb} onPress={() => removePhoto(i)}>
                    <Text style={styles.removeThumbText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addMediaBtn} onPress={pickImage}>
                  <Text style={styles.addMediaText}>📷 إضافة صورة</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>فيديو ({videos.length}/{MAX_VIDEOS})</Text>
            <View style={styles.mediaRow}>
              {videos.map((uri, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <View style={styles.videoPlaceholder}>
                    <Text style={{ fontSize: 24 }}>🎬</Text>
                  </View>
                  <TouchableOpacity style={styles.removeThumb} onPress={() => removeVideo(i)}>
                    <Text style={styles.removeThumbText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {videos.length < MAX_VIDEOS && (
                <TouchableOpacity style={styles.addMediaBtn} onPress={pickVideo}>
                  <Text style={styles.addMediaText}>🎬 إضافة فيديو</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال الطلب</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A3A5C' },
  closeBtn: { fontSize: 24, color: '#6B7280' },
  body: { padding: 20, maxHeight: 500 },
  coords: { fontSize: 12, color: '#6B7280', marginBottom: 16, textAlign: 'right' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, textAlign: 'right' },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  textarea: { minHeight: 80 },
  emptyCategoriesText: { fontSize: 14, color: '#9CA3AF', marginBottom: 16, textAlign: 'right' },
  catRow: { marginBottom: 16 },
  catRowContent: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 4 },
  catChip: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  catChipActive: { backgroundColor: '#2E86AB' },
  catText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  mediaRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 70, borderRadius: 10 },
  videoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeThumbText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addMediaBtn: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMediaText: { fontSize: 11, color: '#6B7280' },
  submitBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 4 }),
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
