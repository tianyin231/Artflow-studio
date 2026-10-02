/**
 * Accounts page RTL tests (F1).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('imports refresh token and shows masked preview', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    importToken.mockResolvedValue({ data: { data: { ok: true } } });
    renderPage();
    const input = await screen.findByTestId('input-refresh-token');
    fireEvent.change(input, { target: { value: 'abcdefghij1234567890xyz' } });
    fireEvent.click(screen.getByTestId('btn-import-token'));
    await waitFor(() => expect(importToken).toHaveBeenCalled());
    expect(await screen.findByTestId('token-preview')).toHaveTextContent(/\*\*\*\*/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['authStatus'] });
  });

  it('lists accounts and allows switch', async () => {
    useAccount.mockResolvedValue({ data: { data: { ok: true } } });
    renderPage();
    expect(await screen.findByTestId('account-u1')).toHaveTextContent('User One');
    fireEvent.click(screen.getByTestId('btn-use-u1'));
    await waitFor(() => expect(useAccount).toHaveBeenCalledWith('u1'));
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
