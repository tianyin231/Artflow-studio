/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Outlet } from 'react-router-dom'
import { AppRoutes } from '../AppRoutes'
import { screen } from '@testing-library/react';

// Mock all page components
jest.mock('../pages/Dashboard', () => ({
  __esModule: true,
  default: () => <div>Dashboard Page</div>,
}));

jest.mock('../pages/Config', () => ({
  __esModule: true,
  default: () => <div>Config Page</div>,
}));

jest.mock('../pages/Download', () => ({
  __esModule: true,
  default: () => <div>Download Page</div>,
}));

jest.mock('../pages/History', () => ({
  __esModule: true,
  default: () => <div>History Page</div>,
}));

jest.mock('../pages/Logs', () => ({
  __esModule: true,
  default: () => <div>Logs Page</div>,
}));

jest.mock('../pages/Files', () => ({
  __esModule: true,
  default: () => <div>Files Page</div>,
}));

jest.mock('../pages/Login', () => ({
  __esModule: true,
  default: () => <div>Login Page</div>,
}));

jest.mock('../pages/Accounts', () => ({
  __esModule: true,
  default: () => <div>Accounts Page</div>,
}));

jest.mock('../components/Layout/AppLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}<Outlet /></div>
  ),
}));

jest.mock('../components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

describe('App', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const _renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('redirects legacy login to accounts inside the app layout', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText('Accounts Page')).toBeInTheDocument();
    expect(screen.getByTestId('app-layout')).toContainElement(screen.getByText('Accounts Page'));
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('keeps accounts navigation inside the app layout', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/accounts']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText('Accounts Page')).toBeInTheDocument();
    expect(screen.getByTestId('app-layout')).toContainElement(screen.getByText('Accounts Page'));
  });

  it('redirects root path to dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    // Should render AppLayout with Dashboard - wait for lazy loading
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders dashboard at /dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders config page at /config', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/config']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders download page at /download', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/download']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders history page at /history', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/history']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders logs page at /logs', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/logs']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });

  it('renders files page at /files', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/files']}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('app-layout')).toBeInTheDocument();
  });
});
