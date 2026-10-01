import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublishCalendarPage from '../../pages/PublishCalendar';

describe('PublishCalendar', () => {
  const qc = new QueryClient();
  it('renders calendar table', () => {
    render(
      <QueryClientProvider client={qc}>
        <PublishCalendarPage />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('publish-calendar-page')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-table')).toBeInTheDocument();
    expect(screen.getByTestId('btn-new-schedule')).toBeInTheDocument();
  });
  it('new schedule adds row', () => {
    render(
      <QueryClientProvider client={qc}>
        <PublishCalendarPage />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByTestId('btn-new-schedule'));
    expect(screen.getByTestId('publish-calendar-page')).toBeInTheDocument();
  });
});
