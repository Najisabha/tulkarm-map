/**
 * منطق شاشة الإبلاغات: التحميل، الفلترة، وتحديث الحالة.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { showMessage } from '../../utils/admin/feedback';
import type { AdminReport } from '../../utils/admin/reportHelpers';

type ReportFilter = 'all' | 'pending';

export function useAdminReports() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>('pending');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReports();
      setReports((res.data as unknown as AdminReport[]) || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const updateStatus = useCallback(async (r: AdminReport, status: 'resolved' | 'dismissed') => {
    try {
      await api.updateReport(r.id, { status });
      setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      showMessage('✅ تم', status === 'resolved' ? 'تم حل الإبلاغ' : 'تم تجاهل الإبلاغ');
    } catch (e: any) {
      showMessage('خطأ', e?.message || 'فشل التحديث');
    }
  }, []);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === 'pending').length,
    [reports],
  );

  const filteredReports = useMemo(
    () => (filter === 'pending' ? reports.filter((r) => r.status === 'pending') : reports),
    [filter, reports],
  );

  return {
    loading,
    filter,
    setFilter,
    pendingCount,
    filteredReports,
    updateStatus,
  };
}

