import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { AdminReport } from '../../utils/admin/reportHelpers';
import { formatArabicReportDate, getReasonLabel } from '../../utils/admin/reportHelpers';
import { adminReportsStyles as styles } from './AdminReports.styles';

export interface AdminReportCardProps {
  report: AdminReport;
  onResolve: (r: AdminReport) => void;
  onDismiss: (r: AdminReport) => void;
}

export function AdminReportCard({ report: r, onResolve, onDismiss }: AdminReportCardProps) {
  const isPending = r.status === 'pending';
  const isResolved = r.status === 'resolved';

  return (
    <View style={styles.reportCard}>
      <Text style={styles.reportStore}>{r.storeName || 'مكان محذوف'}</Text>
      <Text style={styles.reportReason}>{getReasonLabel(r.reason)}</Text>
      {r.details ? <Text style={styles.reportDetails}>{r.details}</Text> : null}
      <Text style={styles.reportDate}>{formatArabicReportDate(r.createdAt)}</Text>

      {isPending ? (
        <View style={styles.reportActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnResolve]}
            onPress={() => onResolve(r)}
          >
            <Text style={styles.actionBtnText}>حل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDismiss]}
            onPress={() => onDismiss(r)}
          >
            <Text style={styles.actionBtnText}>تجاهل</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.statusBadge, isResolved ? styles.statusResolved : styles.statusDismissed]}>
          <Text style={styles.statusText}>{isResolved ? 'تم الحل' : 'تم التجاهل'}</Text>
        </View>
      )}
    </View>
  );
}
