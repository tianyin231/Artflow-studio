import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Plugins from '../../pages/Plugins';

describe('Plugins page', () => {
  it('lists plugins with permissions', () => {
    render(<Plugins />);
    expect(screen.getByTestId('plugins-page')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-publisher-webdav')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-source-local-folder')).toBeInTheDocument();
    expect(screen.getByText(/network: dav.example.com/)).toBeInTheDocument();
  });
  it('toggle switches plugin', () => {
    render(<Plugins />);
    const toggle = screen.getByTestId('toggle-publisher-s3');
    fireEvent.click(toggle);
    expect(screen.getByTestId('plugin-publisher-s3')).toBeInTheDocument();
  });
});
