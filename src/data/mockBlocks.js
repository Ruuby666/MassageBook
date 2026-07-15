// Datos de prueba con la misma forma que tendrán los documentos de Firestore
// (colección "blocks") una vez conectemos la base de datos real.
export const mockBlocks = [
  {
    id: 'b1',
    date: '2026-07-17',
    allDay: false,
    startTime: '13:00',
    endTime: '15:00',
    reason: 'Cita personal',
  },
  {
    id: 'b2',
    date: '2026-07-19',
    allDay: true,
    startTime: null,
    endTime: null,
    reason: 'Descanso',
  },
];
