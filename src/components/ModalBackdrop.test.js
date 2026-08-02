import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import ModalBackdrop from './ModalBackdrop';

describe('ModalBackdrop', () => {
  it('renders its children', async () => {
    const { getByText } = await render(
      <ModalBackdrop visible onRequestClose={() => {}}>
        <Text>Sheet content</Text>
      </ModalBackdrop>
    );
    expect(getByText('Sheet content')).toBeTruthy();
  });

  it('calls onRequestClose when the backdrop is pressed', async () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = await render(
      <ModalBackdrop visible onRequestClose={onRequestClose}>
        <Text>Sheet content</Text>
      </ModalBackdrop>
    );

    fireEvent.press(getByTestId('modal-backdrop'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
