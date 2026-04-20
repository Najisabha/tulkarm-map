import { StyleSheet } from 'react-native';
import { shadow } from '../../utils/shadowStyles';

export const adminActivityStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  topActions: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, flexDirection: 'row-reverse' },
  refreshBtn: {
    backgroundColor: '#1A3A5C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#fff', fontSize: 13 },
  content: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  loadingText: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...shadow({ offset: { width: 0, height: 1 }, opacity: 0.06, radius: 4, elevation: 2 }),
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 14, fontWeight: '600', color: '#1F2937', textAlign: 'right' },
  logDate: { fontSize: 12, color: '#9CA3AF' },
  logDetails: { fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'right' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12 },
  emptyStateText: { color: '#9CA3AF', fontSize: 16 },
});
