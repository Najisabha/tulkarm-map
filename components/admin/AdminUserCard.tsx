import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import type { ApiUser } from '../../utils/admin/userHelpers';
import { avatarLetter } from '../../utils/admin/userHelpers';
import { adminUsersStyles as styles } from './AdminUsers.styles';

export interface AdminUserCardProps {
  user: ApiUser;
  isDefaultAdmin: boolean;
  onEdit: (u: ApiUser) => void;
  onToggleAdmin: (u: ApiUser) => void;
  onDelete: (u: ApiUser) => void;
}

export function AdminUserCard({
  user: u,
  isDefaultAdmin,
  onEdit,
  onToggleAdmin,
  onDelete,
}: AdminUserCardProps) {
  return (
    <View style={styles.userCard}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, u.isAdmin && styles.avatarAdmin]}>
          {u.profileImageUrl ? (
            <Image source={{ uri: u.profileImageUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{avatarLetter(u.name)}</Text>
          )}
        </View>
        <View style={styles.cardMain}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={2}>
              {u.name}
            </Text>
            {u.isAdmin ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>مدير</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.userEmail} selectable>
            {u.email}
          </Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnEdit]}
          onPress={() => onEdit(u)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnEditText}>✎ تعديل البيانات</Text>
        </TouchableOpacity>
        {!isDefaultAdmin ? (
          <>
            <TouchableOpacity
              style={[styles.btn, u.isAdmin ? styles.btnDemote : styles.btnPromote]}
              onPress={() => void onToggleAdmin(u)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnMutedText}>
                {u.isAdmin ? 'إلغاء المدير' : 'ترقية لمدير'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDelete]}
              onPress={() => void onDelete(u)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnDeleteText}>حذف</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}
