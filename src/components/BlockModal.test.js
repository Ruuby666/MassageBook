import { Alert } from 'react-native';
import { act, fireEvent, render, userEvent } from '@testing-library/react-native';
import BlockModal from './BlockModal';

const date = new Date('2026-07-20T00:00:00');

describe('BlockModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts as an all-day block with no time fields shown', async () => {
    const { queryByText } = await render(
      <BlockModal visible date={date} onClose={() => {}} onConfirm={() => {}} />
    );
    expect(queryByText('Desde')).toBeNull();
    expect(queryByText('Hasta')).toBeNull();
  });

  it('reveals the time range fields when "Todo el día" is turned off', async () => {
    const { getByText, getByTestId } = await render(
      <BlockModal visible date={date} onClose={() => {}} onConfirm={() => {}} />
    );

    await act(async () => {
      fireEvent(getByTestId('all-day-switch'), 'valueChange', false);
    });
    expect(getByText('Desde')).toBeTruthy();
    expect(getByText('Hasta')).toBeTruthy();
  });

  it('confirms an all-day block with no reason by default', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue();
    const { getByText } = await render(
      <BlockModal visible date={date} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.press(getByText('Bloquear'));
    expect(onConfirm).toHaveBeenCalledWith({
      allDay: true,
      startTime: null,
      endTime: null,
      reason: '',
    });
  });

  it('confirms a partial-day block with the default 09:00-10:00 range', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue();
    const { getByText, getByTestId } = await render(
      <BlockModal visible date={date} onClose={() => {}} onConfirm={onConfirm} />
    );

    await act(async () => {
      fireEvent(getByTestId('all-day-switch'), 'valueChange', false);
    });
    await user.press(getByText('Bloquear'));

    expect(onConfirm).toHaveBeenCalledWith({
      allDay: false,
      startTime: '09:00',
      endTime: '10:00',
      reason: '',
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('trims the reason before confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockResolvedValue();
    const { getByText, getByPlaceholderText } = await render(
      <BlockModal visible date={date} onClose={() => {}} onConfirm={onConfirm} />
    );

    await user.type(getByPlaceholderText('Motivo (opcional)'), '  Día de descanso  ');
    await user.press(getByText('Bloquear'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Día de descanso' })
    );
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <BlockModal visible date={date} onClose={onClose} onConfirm={() => {}} />
    );

    await user.press(getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
