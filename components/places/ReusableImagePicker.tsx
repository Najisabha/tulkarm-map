/**
 * ReusableImagePicker — مكوّن اختيار الصور قابل لإعادة الاستخدام.
 * مستخرج من AddPlaceModal.
 */

import * as ExpoImagePicker from 'expo-image-picker';
import React from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ReusableImagePickerProps {
  photos: string[];
  maxPhotos?: number;
  /** تسمية تُعرض على زر الإضافة، مثل "صور المنزل" */
  label?: string;
  onPhotosChange: (photos: string[]) => void;
}

export function ReusableImagePicker({
  photos,
  maxPhotos = 3,
  label = 'صور',
  onPhotosChange,
}: ReusableImagePickerProps) {
  const pickImage = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('تنبيه', `الحد الأقصى ${maxPhotos} صور`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'نحتاج إذن الوصول للصور');
        return;
      }
    }
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotosChange([...photos, result.assets[0].uri].slice(0, maxPhotos));
    }
  };

  const removePhoto = (idx: number) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
  };

  return (
    <View style={styles.row}>
      {photos.map((uri, i) => (
        <View key={i} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      {photos.length < maxPhotos && (
        <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
          <Text style={styles.addBtnText}>📷 {label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 70, borderRadius: 10 },
  removeBtn: {
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
  removeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn: {
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
  addBtnText: { fontSize: 11, color: '#6B7280', textAlign: 'center' },
});
