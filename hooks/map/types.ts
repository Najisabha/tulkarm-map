/**
 * أنواع مشتركة لشاشة الخريطة والخطافات المرتبطة بها.
 */

import type { Store } from '../../utils/map/storeModel';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export type StoreWithDistance = Store & { distance: number | null };
