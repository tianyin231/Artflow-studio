import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TemplateLibrary from '../../pages/TemplateLibrary';
import TemplateEditor, { toGraph, fromGraph, detectCycle } from '../../pages/TemplateEditor';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: { success: jest.fn(), error: jest.fn() },
}));

// jsdom lacks ResizeObserver (required by @xyflow/react)
beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});

describe('TemplateEditor', () => {
  const qc = new QueryClient();

  it('toGraph/fromGraph round-trips nodes and edges', () => {
    const g = toGraph({
      id: 't',
      name: 'T',
      nodes: [
        { id: 'a', kind: 'source' },
        { id: 'b', kind: 'render' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(g.nodes.length).toBe(2);
    expect(g.edges.length).toBe(1);
    const tpl = fromGraph(g);
    expect(tpl.nodes[0].id).toBe('a');
    expect(tpl.edges[0]).toEqual({ from: 'a', to: 'b' });
  });

  it('detectCycle finds cycles', () => {
    const g = toGraph({
      id: 't',
      name: 'T',
      nodes: [
        { id: 'a', kind: 'source' },
        { id: 'b', kind: 'render' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(detectCycle(g.nodes, g.edges)).toBe(true);
    expect(
      detectCycle(
        toGraph({ id: 'x', name: 'x', nodes: [{ id: 'a', kind: 'source' }], edges: [] }).nodes,
        []
      )
    ).toBe(false);
  });

  it('opens editor from library and saves JSON', async () => {
    render(
      <QueryClientProvider client={qc}>
        <TemplateLibrary />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByTestId('btn-edit-wuthering-weekly'));
    await waitFor(() => expect(screen.getByTestId('template-editor')).toBeInTheDocument());
    expect(screen.getByTestId('graph-ok')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-save-template'));
    await waitFor(() => expect(screen.getByTestId('saved-template-json')).toBeInTheDocument());
    expect(screen.getByTestId('saved-template-json').textContent).toContain('workflow-template.v1');
  });

  it('preserves node parameters and template variables during JSON round-trip', () => {
    const template = {
      id: 'configured',
      name: 'Configured template',
      nodes: [
        { id: 'src', kind: 'source' as const, params: { tag: '{{tag}}', minBookmarks: 5000 } },
        { id: 'pub', kind: 'publish' as const, params: { platforms: ['local-export'] } },
      ],
      edges: [{ from: 'src', to: 'pub' }],
      variables: { tag: '初音ミク' },
    };
    expect(fromGraph(toGraph(template))).toEqual({ version: 'workflow-template.v1', ...template });
  });

  it('resets the editor when another initial template is selected', () => {
    const onSave = jest.fn();
    const first = toGraph({
      id: 'first',
      name: 'First',
      nodes: [{ id: 'a', kind: 'source' }],
      edges: [],
    });
    const second = toGraph({
      id: 'second',
      name: 'Second',
      nodes: [{ id: 'b', kind: 'publish' }],
      edges: [],
    });
    const view = render(<TemplateEditor initial={first} onSave={onSave} />);
    view.rerender(<TemplateEditor initial={second} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('btn-save-template'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'second',
        name: 'Second',
        nodes: second.nodes,
        edges: [],
      })
    );
  });

  it('prevents saving a cycle, empty graph, or dangling edge', () => {
    const onSave = jest.fn();
    const cyclic = toGraph({
      id: 'bad',
      name: 'Bad',
      nodes: [{ id: 'a', kind: 'source' }],
      edges: [{ from: 'a', to: 'a' }],
    });
    const view = render(<TemplateEditor initial={cyclic} onSave={onSave} />);
    expect(screen.getByTestId('cycle-warning')).toBeInTheDocument();
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
    view.rerender(
      <TemplateEditor
        initial={{ id: 'empty', name: 'Empty', nodes: [], edges: [] }}
        onSave={onSave}
      />
    );
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
    view.rerender(
      <TemplateEditor
        initial={toGraph({
          id: 'dangling',
          name: 'Dangling',
          nodes: [{ id: 'a', kind: 'source' }],
          edges: [{ from: 'a', to: 'missing' }],
        })}
        onSave={onSave}
      />
    );
    expect(screen.getByTestId('btn-save-template')).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-save-template'));
    expect(onSave).not.toHaveBeenCalled();
  });
});
