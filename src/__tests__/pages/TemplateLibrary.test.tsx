import { render, screen, fireEvent, within } from '@testing-library/react';
import { message } from 'antd';
import TemplateLibrary from '../../pages/TemplateLibrary';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { success: jest.fn(), error: jest.fn() },
}));

// Drive actual xyflow state hooks through their change callback. Browser layout
// and pointer geometry are outside the library's save/reload responsibilities.
jest.mock('@xyflow/react', () => ({
  ...jest.requireActual('@xyflow/react'),
  ReactFlow: ({
    nodes,
    onNodesChange,
  }: {
    nodes: { id: string; position: { x: number; y: number } }[];
    onNodesChange: (changes: unknown[]) => void;
  }) => (
    <div>
      <output data-testid="editor-nodes">{JSON.stringify(nodes)}</output>
      <button
        onClick={() =>
          onNodesChange([{ id: nodes[0].id, type: 'position', position: { x: 333, y: 222 } }])
        }
      >
        Move first node
      </button>
    </div>
  ),
}));

describe('TemplateLibrary', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders 8 templates and identifies unavailable execution', () => {
    render(<TemplateLibrary />);
    expect(screen.getByTestId('template-wuthering-weekly')).toBeInTheDocument();
    expect(screen.getByTestId('template-ai-first')).toBeInTheDocument();
    const run = within(screen.getByTestId('template-wuthering-weekly')).getByRole('button', {
      name: /运行/,
    });
    expect(run).toBeDisabled();
    fireEvent.click(run);
    expect(message.success).not.toHaveBeenCalled();
  });

  it('saves node changes and restores them after remount', () => {
    const view = render(<TemplateLibrary />);
    fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
    fireEvent.click(screen.getByRole('button', { name: 'Move first node' }));
    fireEvent.click(screen.getByTestId('btn-save-template'));
    view.unmount();
    render(<TemplateLibrary />);
    fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
    const nodes = JSON.parse(screen.getByTestId('editor-nodes').textContent || '[]');
    expect(nodes[0].position).toEqual({ x: 333, y: 222 });
  });

  it('switches templates without saving the previous template under another ID', () => {
    render(<TemplateLibrary />);
    fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
    fireEvent.click(screen.getByTestId('btn-edit-miku-soft'));
    fireEvent.click(screen.getByTestId('btn-save-template'));
    const template = JSON.parse(screen.getByTestId('saved-template-json').textContent || '{}');
    expect(template).toMatchObject({ id: 'miku-soft', name: '初音柔和图集' });
    expect(template.nodes).toHaveLength(4);
  });

  it('copies a saved graph into a separate template that survives reload', () => {
    const view = render(<TemplateLibrary />);
    fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
    fireEvent.click(screen.getByRole('button', { name: 'Move first node' }));
    fireEvent.click(screen.getByTestId('btn-save-template'));
    fireEvent.click(
      within(screen.getByTestId('template-wuthering-weekly')).getByRole('button', { name: /复制/ })
    );
    view.unmount();
    render(<TemplateLibrary />);
    const copied = screen.getByText('鸣潮周榜卡点（副本）').closest('.ant-card');
    expect(copied).toBeInTheDocument();
    fireEvent.click(within(copied as HTMLElement).getByRole('button', { name: /编辑/ }));
    const nodes = JSON.parse(screen.getByTestId('editor-nodes').textContent || '[]');
    expect(nodes[0].position).toEqual({ x: 333, y: 222 });
    fireEvent.click(screen.getByTestId('btn-save-template'));
    const template = JSON.parse(screen.getByTestId('saved-template-json').textContent || '{}');
    expect(template.id).not.toBe('wuthering-weekly');
    expect(template.name).toBe('鸣潮周榜卡点（副本）');
    expect(screen.getByTestId('template-wuthering-weekly')).toBeInTheDocument();
  });

  it('keeps the editor open and reports storage write failures', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    try {
      render(<TemplateLibrary />);
      fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
      fireEvent.click(screen.getByTestId('btn-save-template'));
      expect(screen.getByTestId('template-editor')).toBeInTheDocument();
      expect(message.error).toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('recovers from malformed persisted templates', () => {
    localStorage.setItem('artflow-template-library-v1', '{invalid');
    render(<TemplateLibrary />);
    expect(screen.getByTestId('template-wuthering-weekly')).toBeInTheDocument();
  });
});
