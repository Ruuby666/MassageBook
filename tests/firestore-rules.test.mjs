// Security rules tests for firestore.rules, run against the Firestore
// emulator: `npm run test:rules` (wraps this in `firebase emulators:exec`,
// which sets FIRESTORE_EMULATOR_HOST). Covers the three kinds of caller:
// the therapist (has a therapists/{uid} doc), any other signed-in account,
// and the public booking form (unauthenticated).
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-massagebook',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'therapists/therapist1'), { name: 'Masajista' });
  await setDoc(doc(db, 'reservations/r1'), { clientName: 'María', status: 'pending' });
  await setDoc(doc(db, 'blocks/b1'), { date: '2026-10-20', allDay: true });
  await setDoc(doc(db, 'services/s1'), { name: 'Relajante', enabled: true });
});

const therapist = env.authenticatedContext('therapist1').firestore();
const stranger = env.authenticatedContext('stranger').firestore();
const anon = env.unauthenticatedContext().firestore();
const TOKEN = 'ExponentPushToken[abc]';

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

console.log('therapist (has therapists/{uid} doc)');
await check('reads reservations', assertSucceeds(getDocs(collection(therapist, 'reservations'))));
await check('reads blocks', assertSucceeds(getDocs(collection(therapist, 'blocks'))));
await check('cannot write reservations directly', assertFails(setDoc(doc(therapist, 'reservations/r2'), { a: 1 })));
await check('creates blocks', assertSucceeds(setDoc(doc(therapist, 'blocks/b2'), { date: '2026-10-21', allDay: true })));
await check('deletes blocks', assertSucceeds(deleteDoc(doc(therapist, 'blocks/b2'))));
await check('edits services', assertSucceeds(setDoc(doc(therapist, 'services/s1'), { name: 'X', enabled: false })));
await check('registers own push token', assertSucceeds(setDoc(doc(therapist, `pushTokens/${TOKEN}`), { token: TOKEN, uid: 'therapist1' })));
await check('cannot register a token for another uid', assertFails(setDoc(doc(therapist, `pushTokens/${TOKEN}`), { token: TOKEN, uid: 'other' })));
await check('cannot register a token under a mismatched id', assertFails(setDoc(doc(therapist, 'pushTokens/other'), { token: TOKEN, uid: 'therapist1' })));
await check('cannot read push tokens', assertFails(getDoc(doc(therapist, `pushTokens/${TOKEN}`))));
await check('reads own therapists doc', assertSucceeds(getDoc(doc(therapist, 'therapists/therapist1'))));
await check('cannot write therapists', assertFails(setDoc(doc(therapist, 'therapists/therapist1'), { name: 'Y' })));
await check('cannot touch booking locks', assertFails(setDoc(doc(therapist, 'slotLocks/2030-07-15'), { x: 1 })));

console.log('stranger (signed in, no therapists doc)');
await check('cannot read reservations', assertFails(getDocs(collection(stranger, 'reservations'))));
await check('cannot read a single reservation', assertFails(getDoc(doc(stranger, 'reservations/r1'))));
await check('cannot read blocks (reasons may be private)', assertFails(getDocs(collection(stranger, 'blocks'))));
await check('cannot create blocks', assertFails(setDoc(doc(stranger, 'blocks/b3'), { allDay: true })));
await check('cannot delete blocks', assertFails(deleteDoc(doc(stranger, 'blocks/b1'))));
await check('cannot edit services', assertFails(setDoc(doc(stranger, 'services/s1'), { price: 1 })));
await check('cannot register a push token', assertFails(setDoc(doc(stranger, `pushTokens/${TOKEN}`), { token: TOKEN, uid: 'stranger' })));
await check('cannot make itself the therapist', assertFails(setDoc(doc(stranger, 'therapists/stranger'), { name: 'Z' })));
await check("cannot read the therapist's doc", assertFails(getDoc(doc(stranger, 'therapists/therapist1'))));

console.log('public web form (unauthenticated)');
await check('cannot read blocks (gets free slots from getAvailability)', assertFails(getDocs(collection(anon, 'blocks'))));
await check('reads services', assertSucceeds(getDocs(collection(anon, 'services'))));
await check('cannot read reservations', assertFails(getDocs(collection(anon, 'reservations'))));
await check('cannot create blocks', assertFails(setDoc(doc(anon, 'blocks/b4'), { allDay: true })));
await check('cannot list therapists', assertFails(getDocs(collection(anon, 'therapists'))));
await check('cannot read booking locks', assertFails(getDoc(doc(anon, 'slotLocks/2030-07-15'))));

await env.cleanup();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
