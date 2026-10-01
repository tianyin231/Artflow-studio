import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TemplateLibrary from '../../pages/TemplateLibrary';
import { toGraph, fromGraph, detectCycle } from '../../pages/TemplateEditor';

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
    expect(detectCycle(toGraph({ id: 'x', name: 'x', nodes: [{ id: 'a', kind: 'source' }], edges: [] }).nodes, [])).toBe(false);
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
});
