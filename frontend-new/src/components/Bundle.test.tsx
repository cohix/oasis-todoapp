import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BundleCard from './Bundle';
import { Bundle } from '../api/bundles';
import { Todo } from '../api/todos';

const baseBundle: Bundle = {
  id: 'bundle-1',
  work_area_id: 'wa-1',
  name: 'Sprint 1',
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const makeTodo = (id: string, title: string, bundle_id: string | null = 'bundle-1'): Todo => ({
  id,
  work_area_id: 'wa-1',
  bundle_id,
  title,
  status: 'todo',
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
});

function renderBundle(bundleOverrides: Partial<Bundle> = {}, todos: Todo[] = [], handlerOverrides: Record<string, any> = {}) {
  const bundle = { ...baseBundle, ...bundleOverrides };
  const defaultHandlers = {
    onDragStartTodo: jest.fn(),
    onDragOverTodo: jest.fn(),
    onDropOnTodo: jest.fn(),
    onDragOverBundle: jest.fn(),
    onDropOnBundle: jest.fn(),
    onDragEnd: jest.fn(),
    onStatusChange: jest.fn(),
    onDeleteTodo: jest.fn(),
    onRename: jest.fn(),
    onErrorAnimationEnd: jest.fn(),
  };
  const props = {
    bundle,
    colorIndex: 0,
    todos,
    draggingTodoId: null,
    dragOverTarget: null,
    selectedTodoId: null,
    errorTodoId: null,
    ...defaultHandlers,
    ...handlerOverrides,
  };
  const result = render(<BundleCard {...props} />);
  return { ...result, bundle, props };
}

// ---- Rendering ----

test('renders bundle name', () => {
  renderBundle();
  expect(screen.getByText('Sprint 1')).toBeInTheDocument();
});

test('renders with aria-label containing "Unnamed bundle" when name is empty', () => {
  renderBundle({ name: '' });
  // Empty name triggers auto-edit mode; the section aria-label still identifies it.
  expect(screen.getByLabelText(/bundle: unnamed bundle/i)).toBeInTheDocument();
});

test('renders todos inside the bundle', () => {
  const todos = [makeTodo('t1', 'Task A'), makeTodo('t2', 'Task B')];
  renderBundle({}, todos);
  expect(screen.getByText('Task A')).toBeInTheDocument();
  expect(screen.getByText('Task B')).toBeInTheDocument();
});

test('renders rename button', () => {
  renderBundle();
  expect(screen.getByRole('button', { name: /rename bundle/i })).toBeInTheDocument();
});

test('applies color class based on colorIndex', () => {
  const { container } = renderBundle({}, [], {});
  expect(container.querySelector('.bundle--color-0')).toBeInTheDocument();
});

test('cycles color class for colorIndex >= 6', () => {
  const bundle = { ...baseBundle };
  const props = {
    bundle,
    colorIndex: 7, // 7 % 6 = 1
    todos: [],
    draggingTodoId: null,
    dragOverTarget: null,
    selectedTodoId: null,
    errorTodoId: null,
    onDragStartTodo: jest.fn(),
    onDragOverTodo: jest.fn(),
    onDropOnTodo: jest.fn(),
    onDragOverBundle: jest.fn(),
    onDropOnBundle: jest.fn(),
    onDragEnd: jest.fn(),
    onStatusChange: jest.fn(),
    onDeleteTodo: jest.fn(),
    onRename: jest.fn(),
    onErrorAnimationEnd: jest.fn(),
  };
  const { container } = render(<BundleCard {...props} />);
  expect(container.querySelector('.bundle--color-1')).toBeInTheDocument();
});

// ---- Rename flow ----

test('clicking rename button shows name input', () => {
  renderBundle();
  fireEvent.click(screen.getByRole('button', { name: /rename bundle/i }));
  expect(screen.getByRole('textbox', { name: /bundle name/i })).toBeInTheDocument();
});

test('pressing Enter in name input calls onRename', () => {
  const onRename = jest.fn();
  renderBundle({}, [], { onRename });
  fireEvent.click(screen.getByRole('button', { name: /rename bundle/i }));
  const input = screen.getByRole('textbox', { name: /bundle name/i });
  fireEvent.change(input, { target: { value: 'Sprint Alpha' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onRename).toHaveBeenCalledWith('bundle-1', 'Sprint Alpha');
});

test('pressing Escape in name input cancels rename', () => {
  renderBundle();
  fireEvent.click(screen.getByRole('button', { name: /rename bundle/i }));
  const input = screen.getByRole('textbox', { name: /bundle name/i });
  fireEvent.change(input, { target: { value: 'New Name' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  // Input should be gone, original name shown
  expect(screen.queryByRole('textbox', { name: /bundle name/i })).not.toBeInTheDocument();
  expect(screen.getByText('Sprint 1')).toBeInTheDocument();
});

test('blurring the name input commits rename', () => {
  const onRename = jest.fn();
  renderBundle({}, [], { onRename });
  fireEvent.click(screen.getByRole('button', { name: /rename bundle/i }));
  const input = screen.getByRole('textbox', { name: /bundle name/i });
  fireEvent.change(input, { target: { value: 'Blurred Name' } });
  fireEvent.blur(input);
  expect(onRename).toHaveBeenCalledWith('bundle-1', 'Blurred Name');
});

test('starts in edit mode when bundle name is empty', () => {
  renderBundle({ name: '' });
  // Input should already be visible (auto-edit on empty name)
  expect(screen.getByRole('textbox', { name: /bundle name/i })).toBeInTheDocument();
});

// ---- Drop zone ----

test('renders drop zone', () => {
  renderBundle();
  expect(screen.getByLabelText(/drop here to add to sprint 1/i)).toBeInTheDocument();
});

test('drop zone becomes visible when a todo is being dragged', () => {
  const { container } = renderBundle({}, [], { draggingTodoId: 't1' });
  expect(container.querySelector('.bundle__drop-zone--visible')).toBeInTheDocument();
});

test('drop zone is active when dragOverTarget matches bundle', () => {
  const { container } = renderBundle({}, [], {
    draggingTodoId: 't1',
    dragOverTarget: 'bundle:bundle-1',
  });
  expect(container.querySelector('.bundle__drop-zone--active')).toBeInTheDocument();
});
