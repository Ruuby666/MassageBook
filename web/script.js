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

const form = document.getElementById('booking-form');
const messageEl = document.getElementById('form-message');
const serviceListEl = document.getElementById('service-list');
const serviceDetailsEl = document.getElementById('service-details');
const dateInput = document.getElementById('date-input');
const timeInput = document.getElementById('time-input');
const dateAvailabilityEl = document.getElementById('date-availability');
const reviewModal = document.getElementById('review-modal');
const reviewListEl = document.getElementById('review-list');
const reviewEditButton = document.getElementById('review-edit-button');
const reviewConfirmButton = document.getElementById('review-confirm-button');

let services = [];
let selectedServiceId = null;
let pendingReservation = null;
let dayFullyBlocked = false;

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ''}`.trim();
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
      selectedServiceId = service.id;
      renderServiceList();
      renderServiceDetails(service);
    });
    serviceListEl.appendChild(item);
  });
}

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

function formatDateTimeDisplay(date, time) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return `${date} ${time}`;
  return parsed.toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function openReviewModal(reservation, service) {
  reviewListEl.innerHTML = '';
  addReviewRow('Nombre', reservation.clientName);
  addReviewRow('Teléfono', reservation.phone);
  addReviewRow('Correo', reservation.email);
  addReviewRow('Dirección', reservation.address);
  addReviewRow('Masaje', `${service.name} · ${service.durationMinutes} min · $${service.price}`);
  addReviewRow('Fecha y hora', formatDateTimeDisplay(reservation.date, reservation.time));
  if (reservation.notes) {
    addReviewRow('Notas', reservation.notes);
  }
  reviewModal.hidden = false;
}

function closeReviewModal() {
  reviewModal.hidden = true;
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

async function checkDateAvailability() {
  dayFullyBlocked = false;
  dateAvailabilityEl.hidden = true;

  const date = dateInput.value;
  if (!date) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'blocks'), where('date', '==', date)));
    dayFullyBlocked = snapshot.docs.some((doc) => doc.data().allDay);
  } catch (error) {
    dayFullyBlocked = false;
  }

  if (dayFullyBlocked) {
    dateAvailabilityEl.textContent = 'Ese día no hay disponibilidad. Elige otra fecha.';
    dateAvailabilityEl.hidden = false;
  }
  timeInput.disabled = dayFullyBlocked;
}

dateInput.addEventListener('change', checkDateAvailability);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setMessage('', '');

  if (dayFullyBlocked) {
    setMessage('Ese día no hay disponibilidad. Elige otra fecha.', 'error');
    return;
  }

  if (!selectedServiceId) {
    setMessage('Elige qué masaje quieres.', 'error');
    return;
  }

  const formData = new FormData(form);
  const clientName = formData.get('clientName').trim();
  const phone = formData.get('phone').trim();
  const email = formData.get('email').trim();
  const address = formData.get('address').trim();
  const notes = formData.get('notes').trim();
  const date = formData.get('date');
  const time = formData.get('time');

  if (!date || !time) {
    setMessage('Elige una fecha y hora.', 'error');
    return;
  }

  const service = services.find((item) => item.id === selectedServiceId);

  pendingReservation = { clientName, phone, email, address, notes, date, time };
  openReviewModal(pendingReservation, service);
});

reviewEditButton.addEventListener('click', () => {
  closeReviewModal();
});

reviewConfirmButton.addEventListener('click', async () => {
  if (!pendingReservation) return;

  const { clientName, phone, email, address, notes, date, time } = pendingReservation;
  const isoDate = new Date(`${date}T${time}:00`).toISOString();

  reviewConfirmButton.disabled = true;
  setMessage('Guardando tu reserva...', '');

  try {
    await createReservation({
      clientName,
      phone,
      email,
      address,
      serviceId: selectedServiceId,
      date: isoDate,
      notes,
    });
    closeReviewModal();
    pendingReservation = null;
    form.reset();
    selectedServiceId = null;
    renderServiceList();
    renderServiceDetails(null);
    setMessage('¡Listo! Tu cita quedó reservada. Te llegará un recordatorio por correo.', 'success');
  } catch (error) {
    closeReviewModal();
    setMessage(error.message || 'No se pudo guardar la reserva. Intenta de nuevo.', 'error');
  } finally {
    reviewConfirmButton.disabled = false;
  }
});
