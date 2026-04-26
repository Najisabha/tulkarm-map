import { Dimensions, Platform, StyleSheet } from 'react-native';
import { shadow } from '../../utils/shadowStyles';

const window = Dimensions.get('window');

export const TYPE_PICKER_MAX_H = Math.min(window.height * 0.62, 520);
export const TYPE_GRID_H_PAD = 16;
export const TYPE_GRID_GAP = 12;
export const TYPE_CARD_WIDTH = (window.width - TYPE_GRID_H_PAD * 2 - TYPE_GRID_GAP) / 2;

export const addPlaceModalStyles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
    elevation: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 0,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    flexDirection: 'column',
    zIndex: 1,
    overflow: 'hidden',
    elevation: 24,
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
  typeStepWrap: { minHeight: 240, flexGrow: 1, flexShrink: 1 },
  typeGridScroll: { flexGrow: 1, flexShrink: 1 },
  typeGridContent: {
    flexDirection: 'column',
    paddingHorizontal: TYPE_GRID_H_PAD,
    paddingTop: 0,
    paddingBottom: 30,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: TYPE_GRID_GAP,
    marginBottom: TYPE_GRID_GAP,
    alignItems: 'stretch',
  },
  typeHint: {
    fontSize: 16, fontWeight: '600', color: '#374151',
    textAlign: 'center', marginBottom: 16, width: '100%',
  },
  noTypesText: { fontSize: 14, color: '#EF4444', textAlign: 'center', marginTop: 20, width: '100%' },
  coords: {
    fontSize: 12, color: '#6B7280',
    marginBottom: 10, marginTop: 4,
    textAlign: 'right', width: '100%', lineHeight: 18,
  },
  typeCard: {
    flexDirection: 'column', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB', gap: 8,
  },
  typeIconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: '#1A3A5C', textAlign: 'center' },
  typeLoadingIndicator: { marginTop: 20 },
  selectedTypeBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0F9FF', borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#BAE6FD', gap: 8,
  },
  selectedTypeBadgeArrow: { fontSize: 14, color: '#2E86AB' },
  selectedTypeDot: { width: 8, height: 8, borderRadius: 4 },
  selectedTypeBadgeText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A3A5C', textAlign: 'right' },
  selectedTypeChange: { fontSize: 13, color: '#2E86AB', fontWeight: '600' },
  formStep: { flexShrink: 1, flexGrow: 1, minHeight: 280, maxHeight: 520 },
  bodyScroll: { flexGrow: 1, flexShrink: 1 },
  bodyScrollContent: { padding: 20, paddingBottom: 12 },
  submitFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  submitBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 8 }),
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnPressed: { opacity: 0.9 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  successScroll: { maxHeight: 520 },
  successScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    alignItems: 'center',
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
    ...shadow({ color: '#15803D', offset: { width: 0, height: 6 }, opacity: 0.35, radius: 12, elevation: 10 }),
  },
  successCheck: { color: '#fff', fontSize: 52, fontWeight: '300', lineHeight: 56, marginTop: -4 },
  successHeadline: {
    fontSize: 22, fontWeight: '800', color: '#14532D',
    textAlign: 'center', marginBottom: 14, paddingHorizontal: 8,
  },
  successText: { fontSize: 16, lineHeight: 26, color: '#4B5563', textAlign: 'center', paddingHorizontal: 4 },
  successBtn: {
    marginTop: 26, alignSelf: 'stretch',
    backgroundColor: '#2E86AB', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.28, radius: 8, elevation: 6 }),
  },
  successBtnText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
