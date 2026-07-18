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
const submitButton = document.getElementById('submit-button');
const messageEl = document.getElementById('form-message');
const serviceListEl = document.getElementById('service-list');
const serviceDetailsEl = document.getElementById('service-details');

let services = [];
let selectedServiceId = null;

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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('', '');

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

  const isoDate = new Date(`${date}T${time}:00`).toISOString();

  submitButton.disabled = true;
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
    form.reset();
    selectedServiceId = null;
    renderServiceList();
    renderServiceDetails(null);
    setMessage('¡Listo! Tu cita quedó reservada. Te llegará un recordatorio por correo.', 'success');
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la reserva. Intenta de nuevo.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});