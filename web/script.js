import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const db = getFirestore(app);
const createReservation = httpsCallable(functions, 'createReservation');
const getAvailability = httpsCallable(functions, 'getAvailability');

const form = document.getElementById('booking-form');
const messageEl = document.getElementById('form-message');
const serviceListEl = document.getElementById('service-list');
const serviceDetailsEl = document.getElementById('service-details');
const availabilityStatusEl = document.getElementById('availability-status');
const calendarEl = document.getElementById('calendar');
const calendarTitleEl = document.getElementById('calendar-title');
const calendarGridEl = document.getElementById('calendar-grid');
const calendarPrevButton = document.getElementById('calendar-prev');
const calendarNextButton = document.getElementById('calendar-next');
const slotsEl = document.getElementById('slots');
const reviewModal = document.getElementById('review-modal');
const reviewListEl = document.getElementById('review-list');
const reviewEditButton = document.getElementById('review-edit-button');
const reviewConfirmButton = document.getElementById('review-confirm-button');

const pendingModal = document.getElementById('pending-modal');
const pendingCloseButton = document.getElementById('pending-close-button');

let services = [];
let selectedServiceId = null;
let pendingReservation = null;

// Availability for the selected massage, from the getAvailability Cloud
// Function: dateKey ("YYYY-MM-DD", Canary local day) → [{ time, start }].
// `start` is the exact instant to book, computed server-side in Canary
// time, so the client's own device timezone never shifts the booking.
let availabilityByDate = new Map();
let bookableDateKeys = [];
let visibleMonth = null; // { year, month } with month 0-11
let selectedDateKey = null;
let selectedSlot = null;
// Guards against a slow response for a previously selected massage
// overwriting the calendar of the one picked after it.
let availabilityRequestId = 0;

// Dates below are built from "YYYY-MM-DD" keys as UTC midnights and always
// formatted with timeZone 'UTC', so labels show the key's own day/month no
// matter where the visitor's device is.
const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dayLabelFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function dateKeyToUtcDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(year, month, day) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDayLabel(dateKey) {
  return capitalize(dayLabelFormatter.format(dateKeyToUtcDate(dateKey)));
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ''}`.trim();
}

// Callable errors carry a "functions/<code>" code. Validation errors from
// our own Cloud Functions already have a client-friendly Spanish message;
// anything else (network down, timeout, server crash) would otherwise show
// raw codes like "internal", so it gets a generic message instead.
function friendlyErrorMessage(error) {
  const code = String(error?.code || '').replace('functions/', '');
  if (['invalid-argument', 'failed-precondition', 'not-found'].includes(code) && error.message) {
    return error.message;
  }
  return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
}

function renderServiceDetails(service) {
  serviceDetailsEl.innerHTML = '';
  if (!service) {
    serviceDetailsEl.hidden = true;
    return;
  }
  serviceDetailsEl.hidden = false;

  const heading = document.createElement('h3');
  heading.textContent = service.name;
  serviceDetailsEl.appendChild(heading);

  if (service.description) {
    const description = document.createElement('p');
    description.textContent = service.description;
    serviceDetailsEl.appendChild(description);
  }

  const meta = document.createElement('p');
  meta.className = 'service-meta';
  meta.textContent = `${service.durationMinutes} min · $${service.price}`;
  serviceDetailsEl.appendChild(meta);

  if (service.materials) {
    const materials = document.createElement('p');
    materials.className = 'service-materials';
    materials.textContent = `Se utiliza: ${service.materials}`;
    serviceDetailsEl.appendChild(materials);
  }
}

function renderServiceList() {
  serviceListEl.innerHTML = '';

  if (services.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'service-loading';
    empty.textContent = 'No hay masajes disponibles por ahora.';
    serviceListEl.appendChild(empty);
    return;
  }

  services.forEach((service) => {
    const item = document.createElement('div');
    item.className = 'service-item' + (service.id === selectedServiceId ? ' selected' : '');
    item.textContent = service.name;
    item.addEventListener('click', () => {
      if (selectedServiceId === service.id) return;
      selectedServiceId = service.id;
      renderServiceList();
      renderServiceDetails(service);
      loadAvailability(service.id);
    });
    serviceListEl.appendChild(item);
  });
}

function setAvailabilityStatus(text) {
  availabilityStatusEl.textContent = text;
  availabilityStatusEl.hidden = !text;
}

function resetAvailability(statusText) {
  availabilityByDate = new Map();
  bookableDateKeys = [];
  visibleMonth = null;
  selectedDateKey = null;
  selectedSlot = null;
  calendarEl.hidden = true;
  slotsEl.hidden = true;
  setAvailabilityStatus(statusText);
}

async function loadAvailability(serviceId, { keepMessage = false } = {}) {
  const requestId = ++availabilityRequestId;
  resetAvailability('Buscando horarios libres…');
  if (!keepMessage) setMessage('', '');

  try {
    const { data } = await getAvailability({ serviceId });
    if (requestId !== availabilityRequestId) return;

    availabilityByDate = new Map(data.days.map((day) => [day.dateKey, day.slots]));
    bookableDateKeys = data.days.map((day) => day.dateKey);

    const firstAvailable = data.days.find((day) => day.slots.length > 0);
    if (!firstAvailable) {
      resetAvailability('No quedan horarios libres para este masaje en los próximos días. Prueba con otro masaje o vuelve más adelante.');
      return;
    }

    const [year, month] = firstAvailable.dateKey.split('-').map(Number);
    visibleMonth = { year, month: month - 1 };
    setAvailabilityStatus('');
    calendarEl.hidden = false;
    renderCalendar();
  } catch (error) {
    if (requestId !== availabilityRequestId) return;
    resetAvailability(friendlyErrorMessage(error));
  }
}

function monthIndex({ year, month }) {
  return year * 12 + month;
}

function shiftVisibleMonth(delta) {
  const index = monthIndex(visibleMonth) + delta;
  visibleMonth = { year: Math.floor(index / 12), month: index % 12 };
  renderCalendar();
}

function renderCalendar() {
  const { year, month } = visibleMonth;
  calendarTitleEl.textContent = capitalize(monthFormatter.format(new Date(Date.UTC(year, month, 1))));

  const [firstKey, lastKey] = [bookableDateKeys[0], bookableDateKeys[bookableDateKeys.length - 1]];
  const toMonth = (key) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 });
  calendarPrevButton.disabled = monthIndex(visibleMonth) <= monthIndex(toMonth(firstKey));
  calendarNextButton.disabled = monthIndex(visibleMonth) >= monthIndex(toMonth(lastKey));

  calendarGridEl.innerHTML = '';
  // Monday-first grid: getUTCDay() is 0 for Sunday.
  const leadingBlanks = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  for (let i = 0; i < leadingBlanks; i += 1) {
    calendarGridEl.appendChild(document.createElement('span'));
  }

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = toDateKey(year, month, day);
    const slots = availabilityByDate.get(dateKey) || [];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day' + (dateKey === selectedDateKey ? ' selected' : '');
    button.textContent = String(day);
    button.disabled = slots.length === 0;
    button.setAttribute(
      'aria-label',
      `${formatDayLabel(dateKey)}${slots.length ? `, ${slots.length} horarios libres` : ', sin disponibilidad'}`
    );
    button.addEventListener('click', () => {
      selectedDateKey = dateKey;
      selectedSlot = null;
      renderCalendar();
      renderSlots();
    });
    calendarGridEl.appendChild(button);
  }
}

function renderSlots() {
  slotsEl.innerHTML = '';
  const slots = availabilityByDate.get(selectedDateKey) || [];
  if (!selectedDateKey || slots.length === 0) {
    slotsEl.hidden = true;
    return;
  }
  slotsEl.hidden = false;

  const title = document.createElement('p');
  title.className = 'slots-title';
  title.textContent = formatDayLabel(selectedDateKey);
  slotsEl.appendChild(title);

  slots.forEach((slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot' + (selectedSlot?.start === slot.start ? ' selected' : '');
    button.textContent = slot.time;
    button.setAttribute('aria-pressed', String(selectedSlot?.start === slot.start));
    button.addEventListener('click', () => {
      selectedSlot = slot;
      renderSlots();
    });
    slotsEl.appendChild(button);
  });
}

calendarPrevButton.addEventListener('click', () => shiftVisibleMonth(-1));
calendarNextButton.addEventListener('click', () => shiftVisibleMonth(1));

function addReviewRow(label, value) {
  const row = document.createElement('div');

  const dt = document.createElement('dt');
  dt.textContent = label;
  row.appendChild(dt);

  const dd = document.createElement('dd');
  dd.textContent = value;
  row.appendChild(dd);

  reviewListEl.appendChild(row);
}

function openReviewModal(reservation, service) {
  reviewListEl.innerHTML = '';
  addReviewRow('Nombre', reservation.clientName);
  addReviewRow('Teléfono', reservation.phone);
  addReviewRow('Correo', reservation.email);
  addReviewRow('Dirección', reservation.address);
  addReviewRow('Masaje', `${service.name} · ${service.durationMinutes} min · $${service.price}`);
  addReviewRow(
    'Fecha y hora',
    `${formatDayLabel(reservation.dateKey)}, ${reservation.slot.time} (hora de Canarias)`
  );
  if (reservation.notes) {
    addReviewRow('Notas', reservation.notes);
  }
  reviewModal.hidden = false;
}

function closeReviewModal() {
  reviewModal.hidden = true;
}

function openPendingModal() {
  pendingModal.hidden = false;
}

function closePendingModal() {
  pendingModal.hidden = true;
}

async function loadServices() {
  try {
    const snapshot = await getDocs(query(collection(db, 'services'), where('enabled', '==', true)));
    services = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    services = [];
  }
  renderServiceList();
}

loadServices();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setMessage('', '');

  if (!selectedServiceId) {
    setMessage('Elige qué masaje quieres.', 'error');
    return;
  }

  if (!selectedSlot) {
    setMessage('Elige un día y una hora en el calendario.', 'error');
    return;
  }

  const formData = new FormData(form);
  const clientName = formData.get('clientName').trim();
  const phone = formData.get('phone').trim();
  const email = formData.get('email').trim();
  const address = formData.get('address').trim();
  const notes = formData.get('notes').trim();

  const service = services.find((item) => item.id === selectedServiceId);

  pendingReservation = {
    clientName,
    phone,
    email,
    address,
    notes,
    dateKey: selectedDateKey,
    slot: selectedSlot,
  };
  openReviewModal(pendingReservation, service);
});

reviewEditButton.addEventListener('click', () => {
  closeReviewModal();
});

reviewConfirmButton.addEventListener('click', async () => {
  if (!pendingReservation) return;

  const { clientName, phone, email, address, notes, slot } = pendingReservation;

  reviewConfirmButton.disabled = true;
  setMessage('Guardando tu reserva...', '');

  try {
    await createReservation({
      clientName,
      phone,
      email,
      address,
      serviceId: selectedServiceId,
      date: slot.start,
      notes,
    });
    closeReviewModal();
    pendingReservation = null;
    form.reset();
    selectedServiceId = null;
    renderServiceList();
    renderServiceDetails(null);
    resetAvailability('Elige primero un masaje para ver los horarios libres.');
    setMessage('', '');
    openPendingModal();
  } catch (error) {
    closeReviewModal();
    const code = String(error?.code || '').replace('functions/', '');
    if (code === 'failed-precondition' && selectedServiceId) {
      // Most likely someone else took the slot after the calendar loaded:
      // refresh it so the client picks from what's actually free now.
      setMessage(`${friendlyErrorMessage(error)} Hemos actualizado los horarios libres.`, 'error');
      loadAvailability(selectedServiceId, { keepMessage: true });
    } else {
      setMessage(friendlyErrorMessage(error), 'error');
    }
  } finally {
    reviewConfirmButton.disabled = false;
  }
});

pendingCloseButton.addEventListener('click', () => {
  closePendingModal();
});
