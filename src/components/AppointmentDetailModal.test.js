import { Alert } from 'react-native';
import { fireEvent, render, userEvent } from '@testing-library/react-native';
import AppointmentDetailModal from './AppointmentDetailModal';

function buildAppointment(overrides = {}) {
  return {
    id: 'apt-1',
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

  describe('editing the date/time', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reveals Fecha/Hora fields when the pencil is pressed, hidden by default', async () => {
      const user = userEvent.setup();
      const { getByTestId, getByText, queryByText } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onEditTime={() => {}} />
      );

      expect(queryByText('Fecha')).toBeNull();

      await user.press(getByTestId('edit-time-button'));
      expect(getByText('Fecha')).toBeTruthy();
      expect(getByText('Hora')).toBeTruthy();
    });

    it('exits editing without saving when Cancelar is pressed', async () => {
      const user = userEvent.setup();
      const onEditTime = jest.fn();
      const { getByTestId, getByText, queryByText } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onEditTime={onEditTime} />
      );

      await user.press(getByTestId('edit-time-button'));
      await user.press(getByText('Cancelar'));

      expect(queryByText('Fecha')).toBeNull();
      expect(onEditTime).not.toHaveBeenCalled();
    });

    it('saves with the appointment id and unchanged date/time when Guardar is pressed', async () => {
      const user = userEvent.setup();
      const onEditTime = jest.fn().mockResolvedValue();
      const { getByTestId, getByText } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onEditTime={onEditTime} />
      );

      await user.press(getByTestId('edit-time-button'));
      await user.press(getByText('Guardar'));

      expect(onEditTime).toHaveBeenCalledWith('apt-1', new Date('2026-07-20T09:00:00'));
    });

    it('exits editing after a successful save', async () => {
      const user = userEvent.setup();
      const onEditTime = jest.fn().mockResolvedValue();
      const { getByTestId, getByText, queryByText } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onEditTime={onEditTime} />
      );

      await user.press(getByTestId('edit-time-button'));
      await user.press(getByText('Guardar'));

      expect(queryByText('Fecha')).toBeNull();
    });

    it('shows an alert and stays in editing mode when the save fails', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const onEditTime = jest.fn().mockRejectedValue(new Error('Ese horario ya está ocupado.'));
      const { getByTestId, getByText } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onEditTime={onEditTime} />
      );

      await user.press(getByTestId('edit-time-button'));
      await user.press(getByText('Guardar'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'No se pudo reprogramar',
        'Ese horario ya está ocupado.'
      );
      expect(getByText('Fecha')).toBeTruthy();
    });
  });
});
