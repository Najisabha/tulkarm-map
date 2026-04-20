export interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: { name?: string };
  createdAt: string;
}

export const ACTION_LABELS: Record<string, string> = {
  add: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  accept: 'قبول',
  reject: 'رفض',
};

export const ENTITY_LABELS: Record<string, string> = {
  category: 'فئة',
  store: 'متجر',
  place_request: 'طلب مكان',
};

export function formatActivityAction(action: string, entityType: string): string {
  return `${ACTION_LABELS[action] || action} ${ENTITY_LABELS[entityType] || entityType}`;
}

export function formatActivityDate(dateIso: string): string {
  return new Date(dateIso).toLocaleString('ar');
}
