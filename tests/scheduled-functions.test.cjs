// Emulator tests for the scheduled Cloud Functions (sendReminders and
// notifyTherapist). They email and push to real people in production, so
// this is the only place to try them: `npm run test:scheduled` runs them
// against the Firestore emulator with Gmail and the Expo push service
// replaced by fakes that only record what would have been sent. Each run
// uses a fixed scheduleTime so the results don't depend on the clock.
const http = require('node:http');
const path = require('node:path');

const functionsDir = path.join(__dirname, '..', 'functions');
const PROJECT = 'demo-massagebook';
process.env.GCLOUD_PROJECT = PROJECT;
// defineSecret().value() reads these outside of a real deploy.
process.env.GMAIL_USER = 'sender@example.com';
process.env.GMAIL_APP_PASSWORD = 'fake';

// Fake Gmail: record emails instead of sending them.
const mails = [];
const nodemailerPath = require.resolve('nodemailer', { paths: [functionsDir] });
require.cache[nodemailerPath] = {
  id: nodemailerPath,
  filename: nodemailerPath,
  loaded: true,
  exports: {
    createTransport: () => ({
      sendMail: async (mail) => {
        mails.push(mail);
        return { messageId: String(mails.length) };
      },
    }),
  },
};

// Fake Expo push service: record pushes instead of sending them.
const pushes = [];
global.fetch = async (url, options) => {
  const messages = JSON.parse(options.body);
  pushes.push(...messages);
  return { ok: true, status: 200, json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }) };
};

const index = require(path.join(functionsDir, 'index.js'));
const { getFirestore, Timestamp } = require(require.resolve('firebase-admin/firestore', { paths: [functionsDir] }));
const db = getFirestore();

const H = 60 * 60000;
// 15 July 2030, 12:00 UTC = 13:00 in the Canary Islands (summer, UTC+1).
const MIDDAY = new Date('2030-07-15T12:00:00.000Z');
// 16 July 2030, 00:30 local: outside the pending-nudge hours.
const NIGHT = new Date('2030-07-15T23:30:00.000Z');

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

// Wipes the emulator between scenarios. Uses node:http directly because
// global.fetch is the fake push service above.
async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await httpDelete(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  mails.length = 0;
  pushes.length = 0;
}

function httpDelete(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'DELETE' }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
}

const at = (now, ms) => Timestamp.fromDate(new Date(now.getTime() + ms));
const base = {
  phone: '600',
  address: 'Calle Triana 12',
  service: 'Masaje relajante',
  durationMinutes: 60,
  price: 50,
  reminderSent: false,
};
const run = (fn, now) => fn.run({ scheduleTime: now.toISOString() });

async function testSendReminders() {
  console.log('sendReminders');
  await clearFirestore();
  const now = MIDDAY;
  const seed = {
    normal: { clientName: 'Normal', email: 'normal@example.com', status: 'confirmed', createdAt: at(now, -72 * H), date: at(now, 30 * H) },
    shortNotice: { clientName: 'Corto', email: 'corto@example.com', status: 'confirmed', createdAt: at(now, -20 * H), date: at(now, 3 * H) },
    legacyNoStatus: { clientName: 'Antigua', email: 'antigua@example.com', createdAt: at(now, -72 * H), date: at(now, 40 * H) },
    pending: { clientName: 'Pendiente', email: 'pendiente@example.com', status: 'pending', createdAt: at(now, -72 * H), date: at(now, 30 * H) },
    justBooked: { clientName: 'Reciente', email: 'reciente@example.com', status: 'confirmed', createdAt: at(now, -2 * H), date: at(now, 20 * H) },
    tooFar: { clientName: 'Lejana', email: 'lejana@example.com', status: 'confirmed', createdAt: at(now, -72 * H), date: at(now, 60 * H) },
    noEmail: { clientName: 'SinCorreo', email: '', status: 'confirmed', createdAt: at(now, -72 * H), date: at(now, 30 * H) },
    alreadySent: { clientName: 'YaAvisada', email: 'ya@example.com', status: 'confirmed', createdAt: at(now, -72 * H), date: at(now, 30 * H), reminderSent: true },
    past: { clientName: 'Pasada', email: 'pasada@example.com', status: 'confirmed', createdAt: at(now, -72 * H), date: at(now, -1 * H) },
  };
  for (const [id, data] of Object.entries(seed)) await db.doc(`reservations/${id}`).set({ ...base, ...data });

  await run(index.sendReminders, now);
  const to = mails.map((m) => m.to);

  check('reminds a normal confirmed booking within 48 h', to.includes('normal@example.com'));
  check('reminds a short-notice booking (appointment in 3 h)', to.includes('corto@example.com'));
  check('reminds legacy bookings without a status', to.includes('antigua@example.com'));
  check('skips pending bookings', !to.includes('pendiente@example.com'));
  check('skips bookings made in the last 12 h', !to.includes('reciente@example.com'));
  check('skips appointments more than 48 h away', !to.includes('lejana@example.com'));
  check('skips already reminded and past appointments', !to.includes('ya@example.com') && !to.includes('pasada@example.com'));
  check('sends exactly 3 emails', mails.length === 3, `${mails.length}: ${to.join(', ')}`);

  const sample = mails.find((m) => m.to === 'normal@example.com');
  check('subject names the massage, day and time', /^Recordatorio: tu Masaje relajante el .+ a las \d\d:\d\d$/.test(sample?.subject || ''), sample?.subject);
  check('sent from the configured Gmail account', sample?.from === 'sender@example.com');
  for (const id of ['normal', 'shortNotice', 'legacyNoStatus']) {
    check(`${id} is flagged reminderSent`, (await db.doc(`reservations/${id}`).get()).data().reminderSent === true);
  }
  check('skipped ones stay unflagged', (await db.doc('reservations/justBooked').get()).data().reminderSent === false);

  const before = mails.length;
  await run(index.sendReminders, new Date(now.getTime() + H));
  check('the next hourly run sends nothing again', mails.length === before, `${mails.length - before} extra`);
}

async function testNotifyTherapist() {
  console.log('notifyTherapist');
  await clearFirestore();
  const now = MIDDAY;
  await db.doc('pushTokens/ExponentPushToken[test]').set({ token: 'ExponentPushToken[test]', uid: 't1' });
  const seed = {
    oldPending: { clientName: 'Carlos', status: 'pending', createdAt: at(now, -3 * H), date: at(now, 24 * H) },
    freshPending: { clientName: 'Nuevo', status: 'pending', createdAt: at(now, -0.5 * H), date: at(now, 30 * H) },
    soon: { clientName: 'María', status: 'confirmed', createdAt: at(now, -48 * H), date: at(now, 50 * 60000) },
    later: { clientName: 'Laura', status: 'confirmed', createdAt: at(now, -48 * H), date: at(now, 3 * H) },
  };
  for (const [id, data] of Object.entries(seed)) await db.doc(`reservations/${id}`).set({ ...base, ...data });

  await run(index.notifyTherapist, now);

  check('heads-up push for the appointment in 50 min', pushes.some((p) => p.title.startsWith('Próxima cita a las') && p.body.includes('Calle Triana 12')));
  check('no heads-up for the appointment in 3 h', !pushes.some((p) => p.body.includes('Laura')));
  check('nudge for the booking pending 3 h', pushes.some((p) => p.title === 'Reserva sin revisar' && p.body.includes('Carlos')));
  check('no nudge for the booking pending 30 min', !pushes.some((p) => p.body.includes('Nuevo')));
  check('pushes go to the reservations channel', pushes.every((p) => p.channelId === 'reservations'));
  check('soon appointment flagged therapistReminderSent', (await db.doc('reservations/soon').get()).data().therapistReminderSent === true);
  check('old pending flagged pendingReminderSent', (await db.doc('reservations/oldPending').get()).data().pendingReminderSent === true);

  const before = pushes.length;
  await run(index.notifyTherapist, new Date(now.getTime() + 15 * 60000));
  check('the next run 15 min later sends nothing again', pushes.length === before, `${pushes.length - before} extra`);

  console.log('notifyTherapist at night');
  await clearFirestore();
  await db.doc('pushTokens/ExponentPushToken[test]').set({ token: 'ExponentPushToken[test]', uid: 't1' });
  await db.doc('reservations/nightPending').set({ ...base, clientName: 'Noche', status: 'pending', createdAt: at(NIGHT, -5 * H), date: at(NIGHT, 30 * H) });
  await run(index.notifyTherapist, NIGHT);
  check('no pending nudge at night', pushes.length === 0, JSON.stringify(pushes.map((p) => p.title)));

  console.log('notifyTherapist with no phone registered');
  await clearFirestore();
  await db.doc('reservations/soon').set({ ...base, ...seed.soon });
  await run(index.notifyTherapist, now);
  check('nothing is flagged, so a later run retries', !(await db.doc('reservations/soon').get()).data().therapistReminderSent);
}

(async () => {
  await testSendReminders();
  await testNotifyTherapist();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
