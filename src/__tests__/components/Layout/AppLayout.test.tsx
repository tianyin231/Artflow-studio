import React from 'react';
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from '../../../components/Layout/AppLayout';
import { screen } from '@testing-library/react';

// Mock the hooks
jest.mock('../../../components/Layout/hooks', () => ({
  useLayoutAuth: () => ({
    isAuthenticated: true,
    isLoggingOut: false,
    isRefreshingToken: false,
    handleLogin: jest.fn(),
    handleLogout: jest.fn(),
    handleRefreshToken: jest.fn(),
  }),
}));

describe('AppLayout', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{component}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should render layout structure', () => {
    renderWithProviders(<AppLayout />);

    const layout = document.querySelector('.paf-shell') || document.querySelector('.ant-layout');
    expect(layout).toBeTruthy();
  });

  // LayoutSider is now a horizontal nav menu (not ant-layout-sider).
  it('should render navigation menu', () => {
    renderWithProviders(<AppLayout />);

    const nav = document.querySelector('.ant-menu') || screen.queryByRole('navigation');
    expect(nav).toBeTruthy();
  });

  it('should render content area', () => {
    renderWithProviders(<AppLayout />);

    const content = document.querySelector('.paf-content') || document.querySelector('.ant-layout-content');
    expect(content).toBeTruthy();
  });

  it('should render topbar', () => {
    renderWithProviders(<AppLayout />);

    const topbar = document.querySelector('.paf-topbar');
    expect(topbar).toBeTruthy();
  });
});
