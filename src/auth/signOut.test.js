import { signOutTherapist } from './signOut';

const calls = [];
const mockSignOut = jest.fn(async () => calls.push('signOut'));
const mockUnregister = jest.fn(async () => calls.push('unregister'));

jest.mock('firebase/auth', () => ({ signOut: (...args) => mockSignOut(...args) }));
jest.mock('../firebase', () => ({ auth: 'auth' }));
jest.mock('../notifications/pushNotifications', () => ({
  unregisterPushNotifications: (...args) => mockUnregister(...args),
}));

describe('signOutTherapist', () => {
  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
  });

  it('removes the push token before signing out', async () => {
    await signOutTherapist();
    expect(calls).toEqual(['unregister', 'signOut']);
    expect(mockSignOut).toHaveBeenCalledWith('auth');
  });

  it('still signs out if removing the token fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockUnregister.mockRejectedValueOnce(new Error('offline'));

    await signOutTherapist();

    expect(mockSignOut).toHaveBeenCalledWith('auth');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
