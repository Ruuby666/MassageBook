import { Alert } from 'react-native';
import { render, userEvent } from '@testing-library/react-native';
import ServiceFormModal from './ServiceFormModal';

const existingService = {
  id: 'svc-1',
  name: 'Masaje relajante',
  description: 'Masaje suave',
  durationMinutes: 60,
  price: 60,
  materials: 'Aceite esencial',
  enabled: true,
};

describe('ServiceFormModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows "Nuevo masaje" and blank fields when creating', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(getByText('Nuevo masaje')).toBeTruthy();
    expect(getByPlaceholderText('Nombre (ej. Masaje relajante)').props.value).toBe('');
  });

  it('shows "Editar masaje" and pre-fills fields when editing', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <ServiceFormModal
        visible
        service={existingService}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(getByText('Editar masaje')).toBeTruthy();
    expect(getByPlaceholderText('Nombre (ej. Masaje relajante)').props.value).toBe(
      'Masaje relajante'
    );
    expect(getByPlaceholderText('Duración (minutos)').props.value).toBe('60');
  });

  it('does not show the delete button when creating', async () => {
    const { queryByText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(queryByText('Eliminar')).toBeNull();
  });

  it('rejects an empty name without calling onConfirm', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.press(getByText('Guardar'));
    expect(Alert.alert).toHaveBeenCalledWith('Falta el nombre', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric duration', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Nombre (ej. Masaje relajante)'), 'Piedras calientes');
    await user.type(getByPlaceholderText('Duración (minutos)'), 'abc');
    await user.type(getByPlaceholderText('Precio (EUR)'), '50');
    await user.press(getByText('Guardar'));

    expect(Alert.alert).toHaveBeenCalledWith('Duración inválida', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('rejects a price of zero or less', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Nombre (ej. Masaje relajante)'), 'Piedras calientes');
    await user.type(getByPlaceholderText('Duración (minutos)'), '60');
    await user.type(getByPlaceholderText('Precio (EUR)'), '0');
    await user.press(getByText('Guardar'));

    expect(Alert.alert).toHaveBeenCalledWith('Precio inválido', expect.any(String));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the trimmed, coerced form data when valid', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue();
    const { getByText, getByPlaceholderText } = await render(
      <ServiceFormModal visible service={null} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Nombre (ej. Masaje relajante)'), '  Piedras calientes  ');
    await user.type(getByPlaceholderText('Duración (minutos)'), '75');
    await user.type(getByPlaceholderText('Precio (EUR)'), '80');
    await user.press(getByText('Guardar'));

    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Piedras calientes',
      description: '',
      durationMinutes: 75,
      price: 80,
      materials: '',
      enabled: true,
    });
  });

  it('asks for confirmation before deleting, and only deletes when confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      const deleteButton = buttons.find((button) => button.style === 'destructive');
      deleteButton.onPress();
    });
    const user = userEvent.setup();
    const onDelete = jest.fn().mockResolvedValue();
    const { getByText } = await render(
      <ServiceFormModal
        visible
        service={existingService}
        onClose={() => {}}
        onConfirm={() => {}}
        onDelete={onDelete}
      />
    );

    await user.press(getByText('Eliminar'));
    expect(alertSpy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('svc-1');
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <ServiceFormModal visible service={null} onClose={onClose} onConfirm={() => {}} />
    );

    await user.press(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
