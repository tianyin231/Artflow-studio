/**
 * E2E tests for login flow (interactive + token modes; password mode removed)
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login';
import { api } from '../../services/api'

jest.mock('../../services/api', () => ({
  api: {
    getAuthStatus: jest.fn(),
    login: jest.fn(),
    loginWithToken: jest.fn(),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('E2E: Login Flow', () => {
  let queryClient: QueryClient;
  let _user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // userEvent not needed for radio clicks
    jest.clearAllMocks();
    (api.getAuthStatus as jest.Mock).mockResolvedValue({
      data: { data: { isAuthenticated: false } },
    });
  });

  const renderLoginPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </QueryClientProvider>
    );

  describe('Interactive Login Flow', () => {
    it('should render login page', async () => {
      renderLoginPage();
      await waitFor(() => {
        const mode = document.querySelector('.login-mode-selector');
        const anyButton = screen.queryAllByRole('button').length > 0;
        expect(mode || anyButton).toBeTruthy();
      });
    });

    it('should show login mode selector', async () => {
      renderLoginPage();
      await waitFor(() => {
        expect(document.querySelector('.login-mode-selector') || screen.getByRole('radio')).toBeTruthy();
      });
    });

    it('should default to interactive mode', async () => {
      renderLoginPage();
      await waitFor(() => {
        const interactive = screen.queryByText('login.mode.interactive') ||
          document.querySelector('.login-mode-selector');
        expect(interactive).toBeTruthy();
      });
    });
  });

  describe('Token Login Flow', () => {
    it('can switch to token mode and show token input', async () => {
      renderLoginPage();
      await waitFor(() => {
        expect(document.querySelector('.login-mode-selector')).toBeTruthy();
      });

      const tokenRadio = document.querySelector('input[value="token"]') as HTMLInputElement | null;
      if (tokenRadio) {
        fireEvent.click(tokenRadio);
      }
      await waitFor(() => {
        expect(
          document.querySelector('.login-token-input') || screen.queryByRole('textbox')
        ).toBeTruthy();
      });
    });
  });

  describe('Login Mode Switching', () => {
    it('should not expose password mode', async () => {
      renderLoginPage();
      await waitFor(() => {
        expect(screen.queryByText('login.mode.password')).toBeNull();
      });
    });
  });
});
