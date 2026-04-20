export interface AdminReport {
  id: string;
  storeId: string;
  storeName: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export const REASON_LABELS: Record<string, string> = {
  wrong_info: 'معلومات خاطئة',
  closed: 'المكان مغلق',
  duplicate: 'تكرار',
  inappropriate: 'محتوى غير لائق',
  other: 'أخرى',
};

export function getReasonLabel(reason: string): string {
  return REASON_LABELS[reason] || reason;
}

export function formatArabicReportDate(date: string): string {
  return new Date(date).toLocaleDateString('ar');
}
