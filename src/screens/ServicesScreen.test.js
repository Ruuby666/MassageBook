import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import ServicesScreen from './ServicesScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let snapshotCallback;
const mockAddDoc = jest.fn().mockResolvedValue();
const mockUpdateDoc = jest.fn().mockResolvedValue();
const mockDeleteDoc = jest.fn().mockResolvedValue();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => name),
  query: jest.fn((collectionRef) => collectionRef),
  orderBy: jest.fn(),
  doc: jest.fn((_db, collectionName, id) => `${collectionName}/${id}`),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  onSnapshot: jest.fn((_query, onNext) => {
    snapshotCallback = onNext;
    return jest.fn(); // unsubscribe
  }),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
}));

jest.mock('../firebase', () => ({ db: {} }));

function emitServices(services) {
  snapshotCallback({
    docs: services.map((service) => ({
      id: service.id,
      data: () => service,
    })),
  });
}

const isisisi = { id: 'svc-1', name: 'isisisi', durationMinutes: 60, price: 60, enabled: true };
const nonon = { id: 'svc-2', name: 'nonon', durationMinutes: 30, price: 25, enabled: false };

describe('ServicesScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state before any services arrive', async () => {
    const { getByText } = await render(<ServicesScreen />);
    expect(getByText('Aún no tienes masajes en tu catálogo')).toBeTruthy();
  });

  it('lists services once the snapshot fires', async () => {
    const { getByText } = await render(<ServicesScreen />);
    await waitFor(() => emitServices([isisisi, nonon]));

    expect(getByText('isisisi')).toBeTruthy();
    expect(getByText('nonon')).toBeTruthy();
    expect(getByText('60 min · $60')).toBeTruthy();
  });

  it('navigates back to Calendario when the back arrow is pressed', async () => {
    const user = userEvent.setup();
    const { getByTestId } = await render(<ServicesScreen />);
    await user.press(getByTestId('back-button'));
    expect(mockNavigate).toHaveBeenCalledWith('Calendario');
  });

  it('toggles a service enabled state', async () => {
    const { getByRole } = await render(<ServicesScreen />);
    await waitFor(() => emitServices([nonon]));

    await act(async () => {
      fireEvent(getByRole('switch'), 'valueChange', true);
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith('services/svc-2', { enabled: true });
  });

  it('opens the create form and saves a new service', async () => {
    const user = userEvent.setup();
    const { getByTestId, getByText, getByPlaceholderText } = await render(<ServicesScreen />);

    await user.press(getByTestId('fab'));
    expect(getByText('Nuevo masaje')).toBeTruthy();

    await user.type(getByPlaceholderText('Nombre (ej. Masaje relajante)'), 'Piedras calientes');
    await user.type(getByPlaceholderText('Duración (minutos)'), '75');
    await user.type(getByPlaceholderText('Precio (EUR)'), '80');
    await user.press(getByText('Guardar'));

    expect(mockAddDoc).toHaveBeenCalledWith('services', {
      name: 'Piedras calientes',
      description: '',
      durationMinutes: 75,
      price: 80,
      materials: '',
      enabled: true,
      createdAt: 'server-timestamp',
    });
  });

  it('opens the edit form when a row is tapped', async () => {
    const user = userEvent.setup();
    const { getByText } = await render(<ServicesScreen />);
    await waitFor(() => emitServices([isisisi]));

    await user.press(getByText('isisisi'));
    expect(getByText('Editar masaje')).toBeTruthy();
  });
});
