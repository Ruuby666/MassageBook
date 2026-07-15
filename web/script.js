import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const createReservation = httpsCallable(functions, 'createReservation');

const form = document.getElementById('booking-form');
const submitButton = document.getElementById('submit-button');
const messageEl = document.getElementById('form-message');

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type || ''}`.trim();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('', '');

  const formData = new FormData(form);
  const clientName = formData.get('clientName').trim();
  const phone = formData.get('phone').trim();
  const email = formData.get('email').trim();
  const address = formData.get('address').trim();
  const service = formData.get('service').trim();
  const durationMinutes = Number(formData.get('durationMinutes'));
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
      service,
      durationMinutes,
      date: isoDate,
      notes,
    });
    form.reset();
    setMessage('¡Listo! Tu cita quedó reservada. Te llegará un recordatorio por correo.', 'success');
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la reserva. Intenta de nuevo.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});
