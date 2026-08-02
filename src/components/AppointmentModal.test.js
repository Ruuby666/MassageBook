import { Alert } from 'react-native';
import { render, userEvent } from '@testing-library/react-native';
import AppointmentModal from './AppointmentModal';

const services = [
  { id: 'svc-1', name: 'Masaje relajante', durationMinutes: 60, price: 60 },
  { id: 'svc-2', name: 'Descontracturante', durationMinutes: 50, price: 50 },
];

const date = new Date('2026-07-20T00:00:00');

async function fillRequiredFields(user, getByPlaceholderText, getByText, serviceName = 'Masaje relajante') {
  await user.type(getByPlaceholderText('Nombre del cliente'), 'María López');
  await user.type(getByPlaceholderText('Dirección'), 'Calle Falsa 123');
  await user.press(getByText(serviceName));
}

describe('AppointmentModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the selected date in the title', async () => {
    const { getByText } = await render(
      <AppointmentModal visible date={date} services={services} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(getByText(/Nueva cita/)).toBeTruthy();
  });

  it('rejects a missing client name or address', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText } = await render(
      <AppointmentModal visible date={date} services={services} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.press(getByText('Guardar'));
    expect(Alert.alert).toHaveBeenCalledWith('Faltan datos', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('rejects when no massage is selected', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <AppointmentModal visible date={date} services={services} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Nombre del cliente'), 'María López');
    await user.type(getByPlaceholderText('Dirección'), 'Calle Falsa 123');
    await user.press(getByText('Guardar'));

    expect(Alert.alert).toHaveBeenCalledWith('Falta el masaje', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('rejects a time that overlaps an existing appointment', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const existingAppointments = [
      { date: new Date('2026-07-20T09:00:00'), durationMinutes: 60 },
    ];
    const { getByText, getByPlaceholderText } = await render(
      <AppointmentModal
        visible
        date={date}
        services={services}
        existingAppointments={existingAppointments}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    await fillRequiredFields(user, getByPlaceholderText, getByText);
    await user.press(getByText('Guardar'));

    expect(Alert.alert).toHaveBeenCalledWith('Horario ocupado', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the trimmed form data when valid', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue();
    const { getByText, getByPlaceholderText } = await render(
      <AppointmentModal visible date={date} services={services} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Nombre del cliente'), '  María López  ');
    await user.type(getByPlaceholderText('Dirección'), '  Calle Falsa 123  ');
    await user.press(getByText('Descontracturante'));
    await user.press(getByText('Guardar'));

    expect(onConfirm).toHaveBeenCalledWith({
      clientName: 'María López',
      phone: '',
      email: '',
      address: 'Calle Falsa 123',
      serviceId: 'svc-2',
      startTime: '09:00',
      notes: '',
    });
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <AppointmentModal visible date={date} services={services} onClose={onClose} onConfirm={() => {}} />
    );

    await user.press(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
