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
  it('hides the action labels until the main button is pressed', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByText } = await render(
      <ExpandableFabMenu actions={buildActions()} />
    );

    expect(queryByText('Masajes')).toBeNull();

    await user.press(getByTestId('fab-menu-toggle'));

    expect(queryByText('Masajes')).toBeTruthy();
    expect(queryByText('Bloquear')).toBeTruthy();
    expect(queryByText('Cita')).toBeTruthy();
  });

  it('collapses again when the main button is pressed a second time', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByText } = await render(
      <ExpandableFabMenu actions={buildActions()} />
    );

    await user.press(getByTestId('fab-menu-toggle'));
    await user.press(getByTestId('fab-menu-toggle'));

    expect(queryByText('Masajes')).toBeNull();
  });

  it('calls the action and collapses the menu when an action is pressed', async () => {
    const user = userEvent.setup();
    const actions = buildActions();
    const { getByTestId, queryByText } = await render(<ExpandableFabMenu actions={actions} />);

    await user.press(getByTestId('fab-menu-toggle'));
    await user.press(getByTestId('fab-block'));

    expect(actions[1].onPress).toHaveBeenCalledTimes(1);
    expect(queryByText('Bloquear')).toBeNull();
  });
});
