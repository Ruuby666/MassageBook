import { fireEvent, render } from '@testing-library/react-native';
import AppointmentDetailModal from './AppointmentDetailModal';

function buildAppointment(overrides = {}) {
  return {
    clientName: 'María López',
    date: new Date('2026-07-20T09:00:00'),
    service: 'Masaje relajante',
    durationMinutes: 60,
    price: 60,
    phone: '685852134',
    email: 'maria@example.com',
    address: 'Calle Falsa 123',
    notes: 'Alergia a la lavanda',
    ...overrides,
  };
}

describe('AppointmentDetailModal', () => {
  it('is not visible when there is no appointment', async () => {
    const { queryByText } = await render(
      <AppointmentDetailModal appointment={null} onClose={() => {}} />
    );
    expect(queryByText('María López')).toBeNull();
  });

  it('shows every field when the appointment has them all', async () => {
    const { getByText } = await render(
      <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} />
    );

    expect(getByText('María López')).toBeTruthy();
    expect(getByText('Masaje relajante')).toBeTruthy();
    expect(getByText('60 min')).toBeTruthy();
    expect(getByText('€60')).toBeTruthy();
    expect(getByText('685852134')).toBeTruthy();
    expect(getByText('maria@example.com')).toBeTruthy();
    expect(getByText('Calle Falsa 123')).toBeTruthy();
    expect(getByText('Alergia a la lavanda')).toBeTruthy();
  });

  it('omits rows for fields the appointment does not have', async () => {
    const { queryByText } = await render(
      <AppointmentDetailModal
        appointment={buildAppointment({ notes: '', price: null })}
        onClose={() => {}}
      />
    );

    expect(queryByText('Notas')).toBeNull();
    expect(queryByText('Precio')).toBeNull();
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <AppointmentDetailModal appointment={buildAppointment()} onClose={onClose} />
    );

    fireEvent.press(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
