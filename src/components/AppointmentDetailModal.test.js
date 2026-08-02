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

  describe('deleting the appointment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('asks for confirmation before deleting', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const { getByTestId } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onDelete={() => {}} />
      );

      await user.press(getByTestId('delete-appointment-button'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Eliminar cita',
        expect.stringContaining('María López'),
        expect.any(Array)
      );
    });

    it('does not delete when the confirmation is dismissed', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const onDelete = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={() => {}} onDelete={onDelete} />
      );

      await user.press(getByTestId('delete-appointment-button'));

      expect(onDelete).not.toHaveBeenCalled();
    });

    it('deletes and closes the modal when confirmed', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        buttons.find((button) => button.style === 'destructive').onPress();
      });
      const user = userEvent.setup();
      const onDelete = jest.fn().mockResolvedValue();
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={onClose} onDelete={onDelete} />
      );

      await user.press(getByTestId('delete-appointment-button'));

      expect(onDelete).toHaveBeenCalledWith('apt-1');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an alert and does not close when deleting fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        if (buttons) {
          buttons.find((button) => button.style === 'destructive').onPress();
        }
      });
      const user = userEvent.setup();
      const onDelete = jest.fn().mockRejectedValue(new Error('No hay conexión.'));
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal appointment={buildAppointment()} onClose={onClose} onDelete={onDelete} />
      );

      await user.press(getByTestId('delete-appointment-button'));

      expect(alertSpy).toHaveBeenLastCalledWith('No se pudo eliminar', 'No hay conexión.');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('confirming or rejecting a pending reservation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('does not show confirm/reject buttons when the reservation is confirmed', async () => {
      const { queryByText } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'confirmed' })}
          onClose={() => {}}
        />
      );

      expect(queryByText('Confirmar reserva')).toBeNull();
      expect(queryByText('Rechazar')).toBeNull();
    });

    it('calls onConfirm and closes the modal when confirming succeeds', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn().mockResolvedValue();
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      await user.press(getByTestId('confirm-reservation-button'));

      expect(onConfirm).toHaveBeenCalledWith('apt-1');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an alert and does not close when confirming fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const onConfirm = jest.fn().mockRejectedValue(new Error('No hay conexión.'));
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      await user.press(getByTestId('confirm-reservation-button'));

      expect(alertSpy).toHaveBeenCalledWith('No se pudo confirmar', 'No hay conexión.');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('asks for confirmation before rejecting', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={() => {}}
          onReject={() => {}}
        />
      );

      await user.press(getByTestId('reject-reservation-button'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Rechazar reserva',
        expect.stringContaining('María López'),
        expect.any(Array)
      );
    });

    it('does not reject when the confirmation is dismissed', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      const onReject = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={() => {}}
          onReject={onReject}
        />
      );

      await user.press(getByTestId('reject-reservation-button'));

      expect(onReject).not.toHaveBeenCalled();
    });

    it('rejects and closes the modal when confirmed', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        buttons.find((button) => button.style === 'destructive').onPress();
      });
      const user = userEvent.setup();
      const onReject = jest.fn().mockResolvedValue();
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={onClose}
          onReject={onReject}
        />
      );

      await user.press(getByTestId('reject-reservation-button'));

      expect(onReject).toHaveBeenCalledWith('apt-1');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an alert and does not close when rejecting fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
        if (buttons) {
          buttons.find((button) => button.style === 'destructive').onPress();
        }
      });
      const user = userEvent.setup();
      const onReject = jest.fn().mockRejectedValue(new Error('No hay conexión.'));
      const onClose = jest.fn();
      const { getByTestId } = await render(
        <AppointmentDetailModal
          appointment={buildAppointment({ status: 'pending' })}
          onClose={onClose}
          onReject={onReject}
        />
      );

      await user.press(getByTestId('reject-reservation-button'));

      expect(alertSpy).toHaveBeenLastCalledWith('No se pudo rechazar', 'No hay conexión.');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
