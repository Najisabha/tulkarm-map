import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {
  TULKARM_GOVERNORATE_LAT,
  TULKARM_GOVERNORATE_LNG,
  TULKARM_GOVERNORATE_RADIUS_METERS,
} from '../constants/tulkarmRegion';
import { isInsideTulkarm as isInsideTulkarmGovernorate } from './tulkarmGovernorate';

/** Geofencing requires a dev build; Expo Go lacks required Info.plist keys */
const isExpoGo = Constants.appOwnership === 'expo';

export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

/** مرجع تقريبي لمنطقة المدينة (عرض فقط؛ التحقق الفعلي بالدائرة في tulkarmGovernorate) */
export const TULKARM_BOUNDS = {
  minLat: 32.294,
  maxLat: 32.322,
  minLng: 35.012,
  maxLng: 35.045,
};

/** دائرة الـ geofencing والخريطة — منطقة المدينة والجوار (متطابقة مع isInsideTulkarm) */
export const TULKARM_REGION = {
  identifier: 'tulkarm-governorate',
  latitude: TULKARM_GOVERNORATE_LAT,
  longitude: TULKARM_GOVERNORATE_LNG,
  radius: TULKARM_GOVERNORATE_RADIUS_METERS,
  notifyOnEnter: true,
  notifyOnExit: true,
};

export { isInsideTulkarmGovernorate as isInsideTulkarm };

TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Geofencing task error:', error);
    return;
  }
  if (data) {
    const { eventType, region } = data;
    if (region.identifier === 'tulkarm-governorate') {
      if (eventType === Location.GeofencingEventType.Enter) {
        sendGeofenceNotification(
          'مرحباً في طولكرم! 🌟',
          'أهلاً وسهلاً بك في مدينة طولكرم الجميلة. اكتشف أفضل المتاجر والمطاعم القريبة منك!'
        );
      } else if (eventType === Location.GeofencingEventType.Exit) {
        sendGeofenceNotification(
          'رافقتك السلامة 👋',
          'شكراً لزيارتك طولكرم. نتطلع لرؤيتك مرة أخرى قريباً!'
        );
      }
    }
  }
});

async function sendGeofenceNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export async function requestPermissions(): Promise<boolean> {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') return false;

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') return false;

  const { status: notifStatus } = await Notifications.requestPermissionsAsync();
  if (notifStatus !== 'granted') return false;

  return true;
}

export async function startGeofencing(): Promise<void> {
  if (isExpoGo) return;
  try {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    const isStarted = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
    if (!isStarted) {
      await Location.startGeofencingAsync(GEOFENCING_TASK, [TULKARM_REGION]);
    }
  } catch (error) {
    console.error('Error starting geofencing:', error);
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    const isStarted = await Location.hasStartedGeofencingAsync(GEOFENCING_TASK);
    if (isStarted) {
      await Location.stopGeofencingAsync(GEOFENCING_TASK);
    }
  } catch (error) {
    console.error('Error stopping geofencing:', error);
  }
}

