const DAY_WINDOW = 30;

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildDayWindow(startDate = new Date(), length = DAY_WINDOW) {
  const days = [];
  for (let i = 0; i < length; i++) {
    const day = new Date(startDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + i);
    days.push(day);
  }
  return days;
}

export function formatDayLabel(date) {
  return date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase();
}

export function formatMonthYear(date) {
  const label = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFullDate(date) {
  const label = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function timeStringToDate(baseDate, timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function dateToTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatTimeString(timeString) {
  return timeStringToDate(new Date(), timeString).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
