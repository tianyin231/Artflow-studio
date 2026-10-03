/**
 * Accounts page RTL tests (F1).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Accounts from '../../pages/Accounts';

const loginStart = jest.fn();
const loginComplete = jest.fn();
const importToken = jest.fn();
const listAccounts = jest.fn();
const useAccount = jest.fn();
const proxyTest = jest.fn();

jest.mock('../../services/api', () => ({
  api: {
    loginStart: (...a: unknown[]) => loginStart(...a),
    loginComplete: (...a: unknown[]) => loginComplete(...a),
    importToken: (...a: unknown[]) => importToken(...a),
    listAccounts: (...a: unknown[]) => listAccounts(...a),
    useAccount: (...a: unknown[]) => useAccount(...a),
    proxyTest: (...a: unknown[]) => proxyTest(...a),
  },
}));

describe('Accounts page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
    delete window.artflow;
    listAccounts.mockResolvedValue({
      data: { data: [{ userId: 'u1', name: 'User One', isDefault: true }] },
    });
    loginStart.mockResolvedValue({
      data: {
        data: {
          loginId: 'lid-1',
          authorizeUrl: 'https://example.invalid/login?code_challenge=abc&code_challenge_method=S256',
          expiresAt: new Date().toISOString(),
        },
      },
    });
  });

  afterEach(() => {
    delete window.artflow;
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Accounts />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders title and login card', async () => {
    renderPage();
    expect(await screen.findByTestId('accounts-title')).toBeInTheDocument();
    expect(screen.getByTestId('pixiv-login-card')).toBeInTheDocument();
  });

  it('opens authorize URL on button click', async () => {
    window.open = jest.fn();
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-open-auth'));
    await waitFor(() => expect(loginStart).toHaveBeenCalled());
    expect(window.open).toHaveBeenCalled();
    expect(await screen.findByTestId('authorize-url')).toBeInTheDocument();
  });

  it('uses the desktop bridge and completes captured OAuth even before the start response renders', async () => {
    let callback: ((payload: { loginId: string; callback: string }) => void) | undefined;
    const cleanup = jest.fn();
    const invoke = jest.fn().mockImplementation(async (channel: string) => {
      if (channel === 'auth.startLogin') {
        callback?.({ loginId: 'desktop-id', callback: 'pixiv://account/login?code=desktop' });
        return { data: { loginId: 'desktop-id', authorizeUrl: 'https://app-api.pixiv.net/web/v1/login' } };
      }
      return { data: { ok: true } };
    });
    window.artflow = { invoke, onOauthCallback: (listener) => { callback = listener; return cleanup; } };
    window.open = jest.fn();
    const page = renderPage();
    fireEvent.click(await screen.findByTestId('btn-open-auth'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('auth.completeLogin', {
      loginId: 'desktop-id', callback: 'pixiv://account/login?code=desktop',
    }));
    await act(async () => {});
    expect(screen.getByTestId('btn-complete-login')).toBeDisabled();
    expect(screen.queryByTestId('authorize-link')).not.toBeInTheDocument();
    expect(loginStart).not.toHaveBeenCalled();
    expect(loginComplete).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    page.unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it('imports desktop tokens through the bridge', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { ok: true } });
    window.artflow = { invoke, onOauthCallback: () => () => {} };
    renderPage();
    fireEvent.change(await screen.findByTestId('input-refresh-token'), { target: { value: ' desktop-token ' } });
    fireEvent.click(screen.getByTestId('btn-import-token'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('auth.importToken', { refreshToken: 'desktop-token' }));
    expect(importToken).not.toHaveBeenCalled();
    expect(await screen.findByTestId('token-preview')).toHaveTextContent(/\*\*\*\*/);
  });

  it('imports refresh token and shows masked preview', async () => {
    importToken.mockResolvedValue({ data: { data: { ok: true } } });
    renderPage();
    const input = await screen.findByTestId('input-refresh-token');
    fireEvent.change(input, { target: { value: 'abcdefghij1234567890xyz' } });
    fireEvent.click(screen.getByTestId('btn-import-token'));
    await waitFor(() => expect(importToken).toHaveBeenCalled());
    expect(await screen.findByTestId('token-preview')).toHaveTextContent(/\*\*\*\*/);
  });

  it('lists accounts and allows switch', async () => {
    listAccounts.mockResolvedValue({ data: { data: [{ userId: 'u1', name: 'User One', isDefault: false }] } });
    useAccount.mockResolvedValue({ data: { data: { ok: true } } });
    renderPage();
    expect(await screen.findByTestId('account-u1')).toHaveTextContent('User One');
    fireEvent.click(screen.getByTestId('btn-use-u1'));
    await waitFor(() => expect(useAccount).toHaveBeenCalledWith('u1'));
  });

  it('shows account load errors and allows retry', async () => {
    listAccounts.mockRejectedValueOnce(new Error('Account service unavailable'));
    renderPage();
    expect(await screen.findByTestId('accounts-error')).toHaveTextContent('Account service unavailable');
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));
    expect(await screen.findByTestId('account-u1')).toBeInTheDocument();
    expect(screen.queryByTestId('accounts-error')).not.toBeInTheDocument();
  });

  it('requires a started login and consumes its session after completion', async () => {
    window.open = jest.fn();
    loginComplete.mockResolvedValue({ data: { data: { ok: true } } });
    renderPage();
    expect(screen.getByTestId('btn-complete-login')).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-open-auth'));
    expect(await screen.findByTestId('authorize-link')).toHaveAttribute('href', expect.stringContaining('https://example.invalid'));
    fireEvent.change(screen.getByTestId('input-callback'), { target: { value: '  pixiv://account/login?code=abc  ' } });
    fireEvent.click(screen.getByTestId('btn-complete-login'));
    await waitFor(() => expect(loginComplete).toHaveBeenCalledWith('lid-1', 'pixiv://account/login?code=abc'));
    await waitFor(() => expect(screen.getByTestId('btn-complete-login')).toBeDisabled());
    expect(screen.queryByTestId('authorize-link')).not.toBeInTheDocument();
  });

  it('rejects blank tokens without sending an import request', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('input-refresh-token'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('btn-import-token'));
    expect(await screen.findByText('请粘贴 token')).toBeInTheDocument();
    expect(importToken).not.toHaveBeenCalled();
  });

  it('proxy test renders results', async () => {
    proxyTest.mockResolvedValue({
      data: { data: { results: [{ target: 'https://app-api.pixiv.net', ok: true, latencyMs: 12 }] } },
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-proxy-test'));
    await waitFor(() => expect(proxyTest).toHaveBeenCalled());
    expect(await screen.findByTestId('proxy-results')).toBeInTheDocument();
  });
});
