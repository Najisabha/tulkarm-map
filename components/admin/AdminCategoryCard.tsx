import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Category } from '../../context/CategoryContext';
import { adminCategoriesStyles as styles } from './AdminCategories.styles';

interface AdminCategoryCardProps {
  category: Category;
  placesCount: number;
  onAttrs: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AdminCategoryCard({
  category,
  placesCount,
  onAttrs,
  onEdit,
  onDelete,
}: AdminCategoryCardProps) {
  return (
    <View style={[styles.categoryCard, { borderColor: `${category.color}44` }]}>
      <View style={[styles.categoryCardIcon, { backgroundColor: `${category.color}22` }]}>
        <Text style={styles.categoryCardEmoji}>{category.emoji}</Text>
      </View>
      <Text style={styles.categoryCardName}>{category.name}</Text>
      <Text style={styles.categoryCardCount}>{placesCount} مكان</Text>
      <View style={styles.categoryCardActions}>
        <TouchableOpacity style={[styles.categoryActionBtn, { backgroundColor: '#E0F2FE' }]} onPress={onAttrs}>
          <Text style={[styles.categoryActionText, { color: '#0369A1' }]}>🔧 الخصائص</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryActionBtn, { backgroundColor: `${category.color}22` }]}
          onPress={onEdit}
        >
          <Text style={[styles.categoryActionText, { color: category.color }]}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryActionBtnDel} onPress={onDelete}>
          <Text style={styles.categoryActionTextDel}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
