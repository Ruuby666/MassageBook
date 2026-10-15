// Push notifications to the therapist's phone through Expo's push service
// (free, relays to FCM on Android — no FCM code or keys here). Kept free of
// Firestore dependencies so it's unit testable, same pattern as
// notifications.js; fetch is injectable for the same reason.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Must match RESERVATIONS_CHANNEL_ID in src/notifications/pushNotifications.js.
const RESERVATIONS_CHANNEL_ID = 'reservations';

const pushDateFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Atlantic/Canary',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Only what's fine to show on a lock screen — phone/address stay in the app.
function buildNewReservationPush(reservation, reservationId) {
  return {
    title: 'Nueva reserva pendiente',
    body: `${reservation.clientName} · ${reservation.service} · ${pushDateFormatter.format(reservation.date)}`,
    data: { reservationId, date: reservation.date.toISOString() },
  };
}

// Returns the tokens Expo reports as no longer registered (app uninstalled,
// permission revoked) so the caller can delete them instead of pushing to
// them forever.
async function sendExpoPush(tokens, message, fetchImpl = fetch) {
  if (tokens.length === 0) return { invalidTokens: [] };

  const response = await fetchImpl(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        sound: 'default',
        priority: 'high',
        channelId: RESERVATIONS_CHANNEL_ID,
        ...message,
      }))
    ),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with status ${response.status}`);
  }

  const { data = [] } = await response.json();
  const invalidTokens = tokens.filter(
    (_, index) =>
      data[index]?.status === 'error' && data[index]?.details?.error === 'DeviceNotRegistered'
  );

  return { invalidTokens };
}

module.exports = {
  EXPO_PUSH_URL,
  RESERVATIONS_CHANNEL_ID,
  buildNewReservationPush,
  sendExpoPush,
};
