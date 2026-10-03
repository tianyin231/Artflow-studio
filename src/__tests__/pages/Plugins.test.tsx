import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Plugins from '../../pages/Plugins';
import { message } from 'antd';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { success: jest.fn(), error: jest.fn() },
}));

describe('Plugins page', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });
  it('lists plugins with permissions', () => {
    render(<Plugins />);
    expect(screen.getByTestId('plugins-page')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-publisher-webdav')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-source-local-folder')).toBeInTheDocument();
    expect(screen.getByText(/network: dav.example.com/)).toBeInTheDocument();
  });
  it('toggle switches plugin and persists the preference after remount', () => {
    const view = render(<Plugins />);
    const toggle = screen.getByTestId('toggle-publisher-s3');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    view.unmount();
    render(<Plugins />);
    expect(screen.getByTestId('toggle-publisher-s3')).toHaveAttribute('aria-checked', 'true');
  });

  it('falls back to default plugin flags after corrupted storage', () => {
    localStorage.setItem('artflow-plugin-preferences-v1', '{"publisher-s3":"yes"}');
    render(<Plugins />);
    expect(screen.getByTestId('toggle-publisher-s3')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not change a switch if its preference cannot be saved', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    try {
      render(<Plugins />);
      fireEvent.click(screen.getByTestId('toggle-publisher-s3'));
      expect(screen.getByTestId('toggle-publisher-s3')).toHaveAttribute('aria-checked', 'false');
      expect(message.error).toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});
