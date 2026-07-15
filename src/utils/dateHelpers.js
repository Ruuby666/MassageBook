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
