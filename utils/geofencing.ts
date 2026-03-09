import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const GEOFENCING_TASK = 'TULKARM_GEOFENCING_TASK';

export const TULKARM_REGION = {
  identifier: 'tulkarm-city',
  latitude: 32.3104,
  longitude: 35.0288,
  radius: 5000,
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
    if (region.identifier === 'tulkarm-city') {
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
  const dx = latitude - TULKARM_REGION.latitude;
  const dy = longitude - TULKARM_REGION.longitude;
  const distanceKm = Math.sqrt(dx * dx + dy * dy) * 111;
  return distanceKm * 1000 <= TULKARM_REGION.radius;
}
