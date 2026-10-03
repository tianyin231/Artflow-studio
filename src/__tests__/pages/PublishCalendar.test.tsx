import { render, screen, fireEvent, within } from '@testing-library/react';
import { message } from 'antd';
import PublishCalendarPage from '../../pages/PublishCalendar';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { success: jest.fn(), error: jest.fn() },
}));

describe('PublishCalendar', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders times in the declared Asia/Shanghai timezone', () => {
    render(<PublishCalendarPage />);
    expect(screen.getByTestId('calendar-table')).toBeInTheDocument();
    expect(screen.getByText('2026-10-02 20:00:00')).toBeInTheDocument();
  });

  it('creates uniquely identified local drafts that survive remount', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1791028800000);
    try {
      const view = render(<PublishCalendarPage />);
      fireEvent.click(screen.getByTestId('btn-new-schedule'));
      fireEvent.click(screen.getByTestId('btn-new-schedule'));
      const saved = JSON.parse(localStorage.getItem('artflow-publish-calendar-v1') || '[]');
      const created = saved.filter(
        (item: { platform: string }) => item.platform === 'local-export'
      );
      expect(created).toHaveLength(2);
      expect(new Set(created.map((item: { id: string }) => item.id)).size).toBe(2);
      view.unmount();
      render(<PublishCalendarPage />);
      expect(
        within(screen.getByTestId('calendar-table')).getAllByText('local-export')
      ).toHaveLength(2);
    } finally {
      now.mockRestore();
    }
  });

  it('uses the time picked by the user as a Shanghai wall-clock time', () => {
    render(<PublishCalendarPage />);
    const picker = screen.getByRole('textbox');
    fireEvent.change(picker, { target: { value: '2026-10-04 20:00:00' } });
    fireEvent.keyDown(picker, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByTestId('btn-new-schedule'));
    const saved = JSON.parse(localStorage.getItem('artflow-publish-calendar-v1') || '[]');
    expect(
      saved.find((item: { platform: string }) => item.platform === 'local-export').isoTime
    ).toBe('2026-10-04T12:00:00.000Z');
  });

  it('persists cancellation and prevents cancelling published entries', () => {
    const view = render(<PublishCalendarPage />);
    expect(screen.getByTestId('btn-cancel-3')).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-cancel-1'));
    expect(screen.getByTestId('btn-cancel-1')).toBeDisabled();
    view.unmount();
    render(<PublishCalendarPage />);
    expect(screen.getByTestId('btn-cancel-1')).toBeDisabled();
    expect(screen.getByText('cancelled')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('recovers from malformed persisted schedules', () => {
    localStorage.setItem('artflow-publish-calendar-v1', '[{"id":"broken"}]');
    render(<PublishCalendarPage />);
    expect(screen.getByTestId('btn-cancel-1')).toBeInTheDocument();
  });

  it('does not claim a draft was saved when storage is unavailable', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    try {
      render(<PublishCalendarPage />);
      fireEvent.click(screen.getByTestId('btn-new-schedule'));
      expect(screen.queryByText('local-export')).not.toBeInTheDocument();
      expect(message.error).toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});
