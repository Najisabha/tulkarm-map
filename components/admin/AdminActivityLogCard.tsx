import React from 'react';
import { Text, View } from 'react-native';
import {
  formatActivityAction,
  formatActivityDate,
  type LogEntry,
} from '../../utils/admin/activityHelpers';
import { adminActivityStyles as styles } from './AdminActivity.styles';

interface AdminActivityLogCardProps {
  entry: LogEntry;
}

export function AdminActivityLogCard({ entry }: AdminActivityLogCardProps) {
  return (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={styles.logAction}>
          {formatActivityAction(entry.action, entry.entityType)}
        </Text>
        <Text style={styles.logDate}>{formatActivityDate(entry.createdAt)}</Text>
      </View>
      {entry.details?.name ? <Text style={styles.logDetails}>{entry.details.name}</Text> : null}
    </View>
  );
}
