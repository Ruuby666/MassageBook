// Emulator test for simultaneous bookings: several clients try to book the
// same slot at the same moment, and only one may get it — whoever finishes
// the whole booking first; the rest get "ese horario ya está ocupado".
// Run with `npm run test:booking` (wraps it in `firebase emulators:exec`).
const path = require('node:path');

const functionsDir = path.join(__dirname, '..', 'functions');
process.env.GCLOUD_PROJECT = 'demo-massagebook';
// Stops the new-booking push from reaching the network.
global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) });

const index = require(path.join(functionsDir, 'index.js'));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [functionsDir] }));
const db = getFirestore();

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

// A public-form booking (no auth) for a fixed future slot:
// 15 July 2030, 10:00 in the Canary Islands (09:00 UTC).
function book(clientName, isoDate = '2030-07-15T09:00:00.000Z') {
  return index.createReservation.run({
    data: {
      clientName,
      phone: '600000000',
      email: `${clientName.toLowerCase()}@example.com`,
      address: 'Calle 1',
      serviceId: 'relajante',
      date: isoDate,
      notes: '',
    },
    auth: null,
  });
}

(async () => {
  await db.doc('services/relajante').set({ name: 'Masaje relajante', durationMinutes: 60, price: 50, enabled: true });

  console.log('5 clients book the same slot at the same time');
  const clients = ['Ana', 'Bea', 'Carla', 'Dani', 'Eva'];
  const results = await Promise.allSettled(clients.map((name) => book(name)));
  const won = results.filter((r) => r.status === 'fulfilled');
  const lost = results.filter((r) => r.status === 'rejected');

  check('exactly one booking succeeds', won.length === 1, `${won.length} succeeded`);
  check(
    'the others are told the slot is taken',
    lost.length === clients.length - 1 && lost.every((r) => r.reason?.code === 'failed-precondition' && /ocupado/.test(r.reason.message)),
    lost.map((r) => `${r.reason?.code}: ${r.reason?.message}`).join(' | ')
  );
  const stored = await db.collection('reservations').get();
  check('only one reservation is stored', stored.size === 1, `${stored.size} stored`);

  console.log('a different slot the same day still works');
  const later = await book('Fran', '2030-07-15T13:00:00.000Z').then(() => true, (e) => e.message);
  check('booking 14:00 local the same day succeeds', later === true, String(later));

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
