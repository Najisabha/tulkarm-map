import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

/** Geofencing requires a dev build; Expo Go lacks required Info.plist keys */
const isExpoGo = Constants.appOwnership === 'expo';

export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

/** محافظة طولكرم - حدود من OpenStreetMap/ويكيبيديا (تضم المدينة + كل القرى والمناطق) */
export const TULKARM_BOUNDS = {
  minLat: 32.19,
  maxLat: 32.47,
  minLng: 35.0,
  maxLng: 35.18,
};

/** دائرة للـ geofencing تغطي كل المحافظة (مركز تقريبي + نصف قطر 20 كم) */
export const TULKARM_REGION = {
  identifier: 'tulkarm-governorate',
  latitude: 32.327,
  longitude: 35.088,
  radius: 20_000,
  notifyOnEnter: true,
  notifyOnExit: true,
};

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

export function isInsideTulkarm(latitude: number, longitude: number): boolean {
  const { minLat, maxLat, minLng, maxLng } = TULKARM_BOUNDS;
  return (
    latitude >= minLat &&
    latitude <= maxLat &&
    longitude >= minLng &&
    longitude <= maxLng
  );
}
