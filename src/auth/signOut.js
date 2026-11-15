import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { unregisterPushNotifications } from '../notifications/pushNotifications';

// Removes this phone's push token first, while still signed in (see
// unregisterPushNotifications). If that fails (e.g. offline) they're still
// signed out; the phone may then keep getting notifications until the app
// is uninstalled or they sign in and out again.
export async function signOutTherapist() {
  try {
    await unregisterPushNotifications();
  } catch (error) {
    console.warn("Could not remove this phone's push token:", error);
  }
  await signOut(auth);
}
