import { render, userEvent } from '@testing-library/react-native';
import ExpandableFabMenu from './ExpandableFabMenu';

function buildActions() {
  return [
    { key: 'masajes', icon: 'pricetags-outline', label: 'Masajes', onPress: jest.fn(), testID: 'fab-masajes' },
    { key: 'block', icon: 'lock-closed', label: 'Bloquear', onPress: jest.fn(), testID: 'fab-block' },
    { key: 'appointment', icon: 'add-circle', label: 'Cita', onPress: jest.fn(), testID: 'fab-appointment' },
  ];
}

describe('ExpandableFabMenu', () => {
  it('starts collapsed', async () => {
    const { getByLabelText } = await render(<ExpandableFabMenu actions={buildActions()} />);
    expect(getByLabelText('Abrir menú')).toBeTruthy();
  });

  it('expands when the main button is pressed', async () => {
    const user = userEvent.setup();
    const { getByTestId, getByLabelText } = await render(
      <ExpandableFabMenu actions={buildActions()} />
    );

    await user.press(getByTestId('fab-menu-toggle'));

    expect(getByLabelText('Cerrar menú')).toBeTruthy();
  });

  it('collapses again when the main button is pressed a second time', async () => {
    const user = userEvent.setup();
    const { getByTestId, getByLabelText } = await render(
      <ExpandableFabMenu actions={buildActions()} />
    );

    await user.press(getByTestId('fab-menu-toggle'));
    await user.press(getByTestId('fab-menu-toggle'));

    expect(getByLabelText('Abrir menú')).toBeTruthy();
  });

  it('calls the action and collapses the menu when an action is pressed', async () => {
    const user = userEvent.setup();
    const actions = buildActions();
    const { getByTestId, getByLabelText } = await render(<ExpandableFabMenu actions={actions} />);

    await user.press(getByTestId('fab-menu-toggle'));
    await user.press(getByTestId('fab-block'));

    expect(actions[1].onPress).toHaveBeenCalledTimes(1);
    expect(getByLabelText('Abrir menú')).toBeTruthy();
  });
});
