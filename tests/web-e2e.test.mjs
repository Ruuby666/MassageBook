// End-to-end test of the public booking form in headless Chrome, against
// the Firestore + Functions emulators: pick a massage, see only the free
// slots, book one, and check it's stored. `npm run test:web` wraps it in
// `firebase emulators:exec`.
//
// web/ itself isn't changed: the page is copied to a temp folder and only
// that copy is pointed at the emulators. Needs Chrome installed (set
// CHROME_PATH if it's not in a standard location) and internet access,
// since the page loads the Firebase SDK from Google's CDN.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import puppeteer from 'puppeteer-core';

const PROJECT = 'demo-massagebook';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [firestoreHost, firestorePort] = FIRESTORE_HOST.split(':');
const FUNCTIONS_PORT = 5001;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? `\n      ${detail}` : ''}`);
}

// --- dates (Canary local days, same as the server) ------------------------
const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Atlantic/Canary',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Atlantic/Canary',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const canaryKey = (date) => keyFormatter.format(date);
function addDays(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
// Canary local HH:MM on a day → the real instant (offset is +0 or +1).
function canaryInstant(key, hh, mm = 0) {
  const [y, m, d] = key.split('-').map(Number);
  const wanted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  for (const offset of [0, 60]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hh, mm) - offset * 60000);
    if (canaryKey(candidate) === key && timeFormatter.format(candidate) === wanted) return candidate;
  }
  throw new Error(`invalid local time ${key} ${wanted}`);
}

const today = canaryKey(new Date());
const tomorrow = addDays(today, 1);
const blockedDay = addDays(today, 2);

// --- copy of web/ pointed at the emulators --------------------------------
function buildSiteCopy() {
  const webDir = new URL('../web/', import.meta.url);
  const siteDir = mkdtempSync(join(tmpdir(), 'massagebook-web-'));
  for (const file of ['index.html', 'styles.css']) {
    writeFileSync(join(siteDir, file), readFileSync(new URL(file, webDir)));
  }
  writeFileSync(
    join(siteDir, 'firebase-config.js'),
    `export const firebaseConfig = { apiKey: 'demo-key', projectId: '${PROJECT}', appId: 'demo' };\n`
  );

  // Normalize first: with git's core.autocrlf (default on Windows) the
  // working copy has CRLF, and the patterns below expect \n.
  let script = readFileSync(new URL('script.js', webDir), 'utf8').replace(/\r\n/g, '\n');
  const patch = (from, to) => {
    if (!script.includes(from)) {
      throw new Error(`web/script.js changed: "${from.trim()}" not found — update tests/web-e2e.test.mjs`);
    }
    script = script.replace(from, to);
  };
  patch('  getFunctions,\n', '  getFunctions,\n  connectFunctionsEmulator,\n');
  patch('  getFirestore,\n', '  getFirestore,\n  connectFirestoreEmulator,\n');
  patch(
    'const db = getFirestore(app);',
    `const db = getFirestore(app);\nconnectFunctionsEmulator(functions, '127.0.0.1', ${FUNCTIONS_PORT});\nconnectFirestoreEmulator(db, '${firestoreHost}', ${firestorePort});`
  );
  writeFileSync(join(siteDir, 'script.js'), script);
  return siteDir;
}

function serve(siteDir) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const server = createServer((req, res) => {
    const file = join(siteDir, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'text/plain' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome not found — set CHROME_PATH to the Chrome executable.');
  return found;
}

// --- seed ------------------------------------------------------------------
const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { host: firestoreHost, port: Number(firestorePort) },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'services/relajante'), { name: 'Masaje relajante', durationMinutes: 60, price: 50, enabled: true });
  await setDoc(doc(db, 'services/oculto'), { name: 'Deshabilitado', durationMinutes: 60, price: 40, enabled: false });
  await setDoc(doc(db, 'blocks/b1'), { date: blockedDay, allDay: true, startTime: null, endTime: null, reason: 'privado' });
  await setDoc(doc(db, 'reservations/r1'), {
    clientName: 'Otra clienta',
    durationMinutes: 60,
    status: 'confirmed',
    date: Timestamp.fromDate(canaryInstant(tomorrow, 10)),
  });
});
console.log(`seeded: tomorrow ${tomorrow} busy 10:00–11:00, ${blockedDay} blocked all day`);

// --- API checks ------------------------------------------------------------
console.log('getAvailability (API)');
const clientApp = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, appId: 'demo' }, 'api');
const functions = getFunctions(clientApp);
connectFunctionsEmulator(functions, '127.0.0.1', FUNCTIONS_PORT);
const getAvailability = httpsCallable(functions, 'getAvailability');

const { data: availability } = await getAvailability({ serviceId: 'relajante' });
const tomorrowTimes = availability.days[0].slots.map((slot) => slot.time);
check('first bookable day is tomorrow (no same-day bookings)', availability.days[0].dateKey === tomorrow, availability.days[0].dateKey);
check('busy slot and its 30-min buffer are hidden', !['09:30', '10:00', '11:00'].some((t) => tomorrowTimes.includes(t)), tomorrowTimes.join(','));
check('blocked day has no slots', availability.days[1].slots.length === 0);
check('no client data or block reasons leak', !/Otra clienta|privado/.test(JSON.stringify(availability)));

// --- browser flow ------------------------------------------------------------
console.log('booking form (headless Chrome)');
const server = await serve(buildSiteCopy());
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 1400 });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.service-item', { timeout: 30000 });
  const services = await page.$$eval('.service-item', (els) => els.map((el) => el.textContent));
  check('only enabled massages are listed', services.length === 1 && services[0] === 'Masaje relajante', services.join(','));

  await page.click('.service-item');
  await page.waitForSelector('.calendar-day:not([disabled])', { timeout: 30000 });
  const price = await page.$eval('.service-meta', (el) => el.textContent);
  check('price is shown in euros', price.includes('€50'), price);

  // The calendar opens on the month of the first free day (tomorrow's).
  const dayButton = (key) =>
    page.evaluate((day) => {
      const button = [...document.querySelectorAll('.calendar-day')].find((b) => b.textContent === String(day));
      return button ? { disabled: button.disabled } : null;
    }, Number(key.slice(8)));
  if (today.slice(0, 7) === tomorrow.slice(0, 7)) {
    check('today cannot be picked', (await dayButton(today))?.disabled === true);
  }
  if (blockedDay.slice(0, 7) === tomorrow.slice(0, 7)) {
    check('the blocked day cannot be picked', (await dayButton(blockedDay))?.disabled === true);
  }

  await page.click('button[type=submit]');
  const noSlotMessage = await page.$eval('#form-message', (el) => el.textContent);
  check('submitting without a time asks for one', /Elige un día y una hora/.test(noSlotMessage), noSlotMessage);

  await page.evaluate((day) => {
    [...document.querySelectorAll('.calendar-day')].find((b) => b.textContent === String(day)).click();
  }, Number(tomorrow.slice(8)));
  await page.waitForSelector('.slot');
  const uiTimes = await page.$$eval('.slot', (els) => els.map((el) => el.textContent));
  check('the day shows the same free slots as the API', JSON.stringify(uiTimes) === JSON.stringify(tomorrowTimes), uiTimes.join(','));

  await page.evaluate(() => [...document.querySelectorAll('.slot')].find((b) => b.textContent === '11:30').click());
  await page.type('input[name=clientName]', 'Ana Prueba');
  await page.type('input[name=phone]', '611222333');
  await page.type('input[name=email]', 'ana@example.com');
  await page.type('input[name=address]', 'Calle Mayor 5, 35001');
  await page.click('button[type=submit]');
  await page.waitForSelector('#review-modal:not([hidden])');
  const review = await page.$eval('#review-list', (el) => el.innerText);
  check('review shows the chosen time in Canary time', review.includes('11:30 (hora de Canarias)'), review);

  await page.click('#review-confirm-button');
  await page.waitForSelector('#pending-modal:not([hidden])', { timeout: 30000 });
  check('booking succeeds and shows the thank-you message', true);

  let saved;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snapshot = await getDocs(collection(ctx.firestore(), 'reservations'));
    saved = snapshot.docs.map((d) => d.data()).find((r) => r.clientName === 'Ana Prueba');
  });
  const expectedStart = availability.days[0].slots.find((slot) => slot.time === '11:30').start;
  check(
    'stored at the exact slot, as pending, with server-side price',
    saved?.date.toDate().toISOString() === expectedStart && saved?.status === 'pending' && saved?.price === 50,
    JSON.stringify(saved && { date: saved.date.toDate(), status: saved.status, price: saved.price })
  );

  const { data: after } = await getAvailability({ serviceId: 'relajante' });
  const afterTimes = after.days[0].slots.map((slot) => slot.time);
  check('the booked slot is no longer offered', !afterTimes.includes('11:30') && !afterTimes.includes('12:00'), afterTimes.join(','));
  check('no JavaScript errors on the page', pageErrors.length === 0, pageErrors.join(' | '));

  console.log('massages fail to load (Firestore unreachable)');
  const offline = await browser.newPage();
  await offline.setRequestInterception(true);
  offline.on('request', (request) =>
    request.url().includes(`:${firestorePort}/`) ? request.abort() : request.continue()
  );
  await offline.goto(url, { waitUntil: 'domcontentloaded' });
  const shownError = await offline
    .waitForFunction(
      () => /No pudimos cargar los masajes/.test(document.querySelector('#service-list')?.textContent || ''),
      { timeout: 60000 }
    )
    .then(() => true, () => false);
  const finalText = await offline.$eval('#service-list', (el) => el.textContent.trim());
  check('tells the client the massages failed to load, not that there are none', shownError, finalText);
} finally {
  await browser.close();
  server.close();
  await env.cleanup();
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
