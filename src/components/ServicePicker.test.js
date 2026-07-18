import { fireEvent, render } from '@testing-library/react-native';
import ServicePicker from './ServicePicker';

const services = [
  {
    id: 'svc-1',
    name: 'Masaje relajante',
    description: 'Masaje suave para liberar tensión.',
    durationMinutes: 60,
    price: 60,
    materials: 'Aceite esencial de lavanda',
  },
  {
    id: 'svc-2',
    name: 'Descontracturante',
    durationMinutes: 50,
    price: 50,
  },
];

describe('ServicePicker', () => {
  it('shows an empty message when there are no services', async () => {
    const { getByText } = await render(
      <ServicePicker services={[]} selectedId={null} onSelect={() => {}} />
    );
    expect(getByText('No hay masajes disponibles todavía.')).toBeTruthy();
  });

  it('lists every service name as a chip', async () => {
    const { getByText } = await render(
      <ServicePicker services={services} selectedId={null} onSelect={() => {}} />
    );
    expect(getByText('Masaje relajante')).toBeTruthy();
    expect(getByText('Descontracturante')).toBeTruthy();
  });

  it('does not show a detail panel until a service is selected', async () => {
    const { queryByText } = await render(
      <ServicePicker services={services} selectedId={null} onSelect={() => {}} />
    );
    expect(queryByText('60 min')).toBeNull();
  });

  it('shows the full detail panel for the selected service', async () => {
    const { getByText } = await render(
      <ServicePicker services={services} selectedId="svc-1" onSelect={() => {}} />
    );
    expect(getByText('Masaje suave para liberar tensión.')).toBeTruthy();
    expect(getByText('60 min')).toBeTruthy();
    expect(getByText('$60')).toBeTruthy();
    expect(getByText('Se utiliza: Aceite esencial de lavanda')).toBeTruthy();
  });

  it('calls onSelect with the tapped service id', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <ServicePicker services={services} selectedId={null} onSelect={onSelect} />
    );

    fireEvent.press(getByText('Descontracturante'));
    expect(onSelect).toHaveBeenCalledWith('svc-2');
  });
});
