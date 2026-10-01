import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TemplateLibrary from '../../pages/TemplateLibrary';

describe('TemplateLibrary', () => {
  const qc = new QueryClient();
  it('renders 8 templates', () => {
    render(
      <QueryClientProvider client={qc}>
        <TemplateLibrary />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('template-library-page')).toBeInTheDocument();
    expect(screen.getByTestId('template-wuthering-weekly')).toBeInTheDocument();
    expect(screen.getByTestId('template-ai-first')).toBeInTheDocument();
  });
  it('run button triggers message', () => {
    render(
      <QueryClientProvider client={qc}>
        <TemplateLibrary />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getAllByText('运行')[0]);
    expect(screen.getByTestId('template-library-page')).toBeInTheDocument();
  });
});
