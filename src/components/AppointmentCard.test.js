import { fireEvent, render } from '@testing-library/react-native';
import AppointmentCard from './AppointmentCard';

function buildAppointment(overrides = {}) {
  return {
    clientName: 'Lucía Fernández',
    phone: '685852134',
    address: 'Av. Álvaro Obregón 200',
    service: 'Masaje relajante',
    durationMinutes: 50,
    date: new Date('2026-07-20T11:00:00'),
    notes: '',
    ...overrides,
  };
}

describe('AppointmentCard', () => {
  it('shows the client, service, duration and address', async () => {
    const { getByText } = await render(
      <AppointmentCard appointment={buildAppointment()} onPress={() => {}} />
    );
    expect(getByText('Lucía Fernández')).toBeTruthy();
    expect(getByText('Masaje relajante')).toBeTruthy();
    expect(getByText('50 min')).toBeTruthy();
    expect(getByText('Av. Álvaro Obregón 200')).toBeTruthy();
  });

  it('only shows notes when present', async () => {
    const { queryByText, rerender } = await render(
      <AppointmentCard appointment={buildAppointment({ notes: '' })} onPress={() => {}} />
    );
    expect(queryByText('Alergia')).toBeNull();

    await rerender(
      <AppointmentCard appointment={buildAppointment({ notes: 'Alergia' })} onPress={() => {}} />
    );
    expect(queryByText('Alergia')).toBeTruthy();
  });

  it('calls onPress with the full appointment when tapped', async () => {
    const onPress = jest.fn();
    const appointment = buildAppointment();
    const { getByText } = await render(
      <AppointmentCard appointment={appointment} onPress={onPress} />
    );

    fireEvent.press(getByText('Lucía Fernández'));
    expect(onPress).toHaveBeenCalledWith(appointment);
  });

  it('does not throw when onPress is not provided', async () => {
    const { getByText } = await render(<AppointmentCard appointment={buildAppointment()} />);
    expect(() => fireEvent.press(getByText('Lucía Fernández'))).not.toThrow();
  });
});
