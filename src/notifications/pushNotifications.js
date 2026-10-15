import Constants from 'expo-constants';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { db } from '../firebase';

// Must match RESERVATIONS_CHANNEL_ID in functions/push.js.
const RESERVATIONS_CHANNEL_ID = 'reservations';

// Push is Android-only and needs a real EAS build — Expo Go dropped remote
// push on Android in SDK 53, and web/iOS aren't set up. Everywhere else
// expo-notifications/expo-device are never even loaded (lazy require below),
// so they can't log errors or break anything; the pending banner in
// CalendarScreen is the fallback there.
const pushSupported =
  Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient';

const Notifications = pushSupported ? require('expo-notifications') : null;
const Device = pushSupported ? require('expo-device') : null;

if (Notifications) {
  // Show the banner even while the app is open, not just in background.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Asks for permission, gets this phone's Expo push token and stores it in
// `pushTokens/{token}` so createReservation can notify it. Safe to call on
// every login — the token doc is just overwritten.
export async function registerForPushNotifications(uid) {
  if (!Notifications || !Device.isDevice) return null;

  await Notifications.setNotificationChannelAsync(RESERVATIONS_CHANNEL_ID, {
    name: 'Reservas',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  });

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  // Written into app config by `eas init`; without it Expo can't issue a token.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('Push notifications disabled: no EAS projectId (run `eas init`).');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await setDoc(doc(db, 'pushTokens', token), {
    token,
    uid,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  });
  return token;
}

// Calls onOpen with the notification's data when the therapist taps one —
// both while the app is running and when the tap is what launched it.
export function useNotificationTap(onOpen) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!Notifications) return undefined;

    function handle(response) {
      const data = response?.notification?.request?.content?.data;
      if (data) onOpenRef.current(data);
    }

    const launchResponse = Notifications.getLastNotificationResponse();
    if (launchResponse) {
      handle(launchResponse);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);
}
