import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WorkArea from './WorkArea';
import * as todosApi from '../api/todos';
import * as bundlesApi from '../api/bundles';
import { Todo } from '../api/todos';
import { Bundle } from '../api/bundles';

// ---- Factories ----

const makeTodo = (id: string, title: string, bundle_id: string | null = null, position = 0): Todo => ({
  id,
  work_area_id: 'wa-1',
  bundle_id,
  title,
  status: 'todo',
  position,
  created_at: '',
  updated_at: '',
});

const makeBundle = (id: string, name: string, position = 0): Bundle => ({
  id,
  work_area_id: 'wa-1',
  name,
  position,
  created_at: '',
  updated_at: '',
});

// ---- Setup ----

const noop = () => {};
const noopAsync = async () => {};
const defaultKbdProps = {
  selectedTodoId: null as string | null,
  onTodoSelect: jest.fn() as (id: string | null) => void,
  onMoveTodoToArea: jest.fn().mockResolvedValue(false) as (todo: Todo, direction: 'left' | 'right') => Promise<boolean>,
};

function renderWorkArea(overrides: Partial<{
  workAreaId: string;
  selectedTodoId: string | null;
  onTodoSelect: (id: string | null) => void;
  onMoveTodoToArea: (todo: Todo, direction: 'left' | 'right') => Promise<boolean>;
}> = {}) {
  const props = { ...defaultKbdProps, workAreaId: 'wa-1', ...overrides };
  return render(<WorkArea {...props} />);
}

beforeEach(() => {
  jest.spyOn(bundlesApi, 'fetchBundles').mockResolvedValue([]);
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([]);
  defaultKbdProps.onTodoSelect = jest.fn();
  defaultKbdProps.onMoveTodoToArea = jest.fn().mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

// ---- Rendering ----

test('renders new todo input', async () => {
  renderWorkArea();
  expect(screen.getByRole('textbox', { name: /new todo/i })).toBeInTheDocument();
});

test('shows empty state message when there are no todos', async () => {
  renderWorkArea();
  await waitFor(() =>
    expect(screen.getByText(/no todos yet/i)).toBeInTheDocument()
  );
});

test('renders fetched todos after load', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'Buy milk'),
    makeTodo('t2', 'Write docs'),
  ]);
  renderWorkArea();
  await waitFor(() => expect(screen.getByText('Buy milk')).toBeInTheDocument());
  expect(screen.getByText('Write docs')).toBeInTheDocument();
});

test('renders bundle and its todos after load', async () => {
  jest.spyOn(bundlesApi, 'fetchBundles').mockResolvedValue([makeBundle('b1', 'Sprint 1')]);
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Bundled task', 'b1')]);
  renderWorkArea();
  await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());
  expect(screen.getByText('Bundled task')).toBeInTheDocument();
});

test('reloads data when workAreaId prop changes', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Task in WA1')]);
  const { rerender } = renderWorkArea();
  await waitFor(() => expect(screen.getByText('Task in WA1')).toBeInTheDocument());

  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t2', 'Task in WA2')]);
  rerender(<WorkArea workAreaId="wa-2" {...defaultKbdProps} />);
  await waitFor(() => expect(screen.getByText('Task in WA2')).toBeInTheDocument());
  expect(screen.queryByText('Task in WA1')).not.toBeInTheDocument();
});

// ---- Create todo ----

test('creates a todo when Enter is pressed in the input', async () => {
  const newTodo = makeTodo('t-new', 'New task');
  jest.spyOn(todosApi, 'createTodo').mockResolvedValue(newTodo);

  renderWorkArea();
  // Wait for initial load to settle before acting
  await waitFor(() => expect(todosApi.fetchTodos).toHaveBeenCalled());

  const input = screen.getByRole('textbox', { name: /new todo/i });
  await act(async () => {
    fireEvent.change(input, { target: { value: 'New task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });

  await waitFor(() => expect(screen.getByText('New task')).toBeInTheDocument());
  expect(todosApi.createTodo).toHaveBeenCalledWith('wa-1', 'New task');
});

test('does not create todo when Enter is pressed with empty input', async () => {
  jest.spyOn(todosApi, 'createTodo').mockResolvedValue(makeTodo('t1', ''));
  renderWorkArea();
  await waitFor(() => expect(todosApi.fetchTodos).toHaveBeenCalled());
  const input = screen.getByRole('textbox', { name: /new todo/i });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(todosApi.createTodo).not.toHaveBeenCalled();
});

test('clears the input after creating a todo', async () => {
  jest.spyOn(todosApi, 'createTodo').mockResolvedValue(makeTodo('t-new', 'Task'));
  renderWorkArea();
  await waitFor(() => expect(todosApi.fetchTodos).toHaveBeenCalled());
  const input = screen.getByRole('textbox', { name: /new todo/i }) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { value: 'Task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });
  await waitFor(() => expect(input.value).toBe(''));
});

// ---- Status change ----

test('updates todo status when a transition button is clicked', async () => {
  const todo = makeTodo('t1', 'Fix bug');
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([todo]);
  const updated: Todo = { ...todo, status: 'in_progress' };
  jest.spyOn(todosApi, 'updateTodo').mockResolvedValue(updated);

  renderWorkArea();
  await waitFor(() => expect(screen.getByText('Fix bug')).toBeInTheDocument());

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /mark as in progress/i }));
  });

  expect(todosApi.updateTodo).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress' }));
});

// ---- Delete todo ----

test('removes todo from the list after deletion', async () => {
  const todo = makeTodo('t1', 'Remove me');
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([todo]);
  jest.spyOn(todosApi, 'deleteTodo').mockResolvedValue(undefined);

  renderWorkArea();
  await waitFor(() => expect(screen.getByText('Remove me')).toBeInTheDocument());

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /delete todo/i }));
  });

  expect(screen.queryByText('Remove me')).not.toBeInTheDocument();
  expect(todosApi.deleteTodo).toHaveBeenCalledWith('t1');
});

test('removes empty bundle from UI when its last todo is deleted', async () => {
  const bundle = makeBundle('b1', 'Sprint 1');
  const todo = makeTodo('t1', 'Only task', 'b1');
  jest.spyOn(bundlesApi, 'fetchBundles').mockResolvedValue([bundle]);
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([todo]);
  jest.spyOn(todosApi, 'deleteTodo').mockResolvedValue(undefined);

  renderWorkArea();
  await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /delete todo/i }));
  });

  expect(screen.queryByText('Sprint 1')).not.toBeInTheDocument();
});

// ---- Keyboard navigation ----

test('pressing ArrowDown with no selection calls onTodoSelect with first todo', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'First', null, 0),
    makeTodo('t2', 'Second', null, 1),
  ]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ onTodoSelect });
  await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

  act(() => { fireEvent.keyDown(document, { key: 'ArrowDown' }); });
  expect(onTodoSelect).toHaveBeenCalledWith('t1');
});

test('pressing ArrowUp with no selection calls onTodoSelect with last todo', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'First', null, 0),
    makeTodo('t2', 'Last', null, 1),
  ]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ onTodoSelect });
  await waitFor(() => expect(screen.getByText('Last')).toBeInTheDocument());

  act(() => { fireEvent.keyDown(document, { key: 'ArrowUp' }); });
  expect(onTodoSelect).toHaveBeenCalledWith('t2');
});

test('pressing ArrowDown with selected todo calls onTodoSelect with next todo', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'First', null, 0),
    makeTodo('t2', 'Second', null, 1),
  ]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ selectedTodoId: 't1', onTodoSelect });
  await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

  act(() => { fireEvent.keyDown(document, { key: 'ArrowDown' }); });
  expect(onTodoSelect).toHaveBeenCalledWith('t2');
});

test('pressing ArrowDown at the end of the list does not call onTodoSelect', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Only', null, 0)]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ selectedTodoId: 't1', onTodoSelect });
  await waitFor(() => expect(screen.getByText('Only')).toBeInTheDocument());

  act(() => { fireEvent.keyDown(document, { key: 'ArrowDown' }); });
  expect(onTodoSelect).not.toHaveBeenCalled();
});

test('pressing Escape calls onTodoSelect with null', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Task', null, 0)]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ selectedTodoId: 't1', onTodoSelect });
  await waitFor(() => expect(screen.getByText('Task')).toBeInTheDocument());

  act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
  expect(onTodoSelect).toHaveBeenCalledWith(null);
});

test('pressing T focuses the new-todo input', async () => {
  renderWorkArea();
  await waitFor(() => expect(todosApi.fetchTodos).toHaveBeenCalled());

  act(() => { fireEvent.keyDown(document, { key: 't' }); });
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /new todo/i }));
});

test('pressing W with ungrouped todo and no bundles moves toward top by bundling with item above', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'First', null, 0),
    makeTodo('t2', 'Second', null, 1),
  ]);
  const newBundle = makeBundle('b-new', '');
  jest.spyOn(bundlesApi, 'createBundle').mockResolvedValue(newBundle);
  jest.spyOn(todosApi, 'updateTodo').mockImplementation(async (t: Todo) => t);

  renderWorkArea({ selectedTodoId: 't2' });
  await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());

  await act(async () => { fireEvent.keyDown(document, { key: 'W' }); });
  expect(bundlesApi.createBundle).toHaveBeenCalledWith('wa-1', '');
  expect(todosApi.updateTodo).toHaveBeenCalledWith(expect.objectContaining({ id: 't2', bundle_id: 'b-new' }));
});

test('pressing S with todo in last bundle ungroups it', async () => {
  const bundle = makeBundle('b1', 'Sprint 1');
  jest.spyOn(bundlesApi, 'fetchBundles').mockResolvedValue([bundle]);
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Task', 'b1')]);
  const updated = makeTodo('t1', 'Task', null);
  jest.spyOn(todosApi, 'updateTodo').mockResolvedValue(updated);

  renderWorkArea({ selectedTodoId: 't1' });
  await waitFor(() => expect(screen.getByText('Task')).toBeInTheDocument());

  await act(async () => { fireEvent.keyDown(document, { key: 's' }); });
  expect(todosApi.updateTodo).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', bundle_id: null }));
});

test('pressing A calls onMoveTodoToArea with left direction', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Task', null, 0)]);
  jest.spyOn(todosApi, 'deleteTodo').mockResolvedValue(undefined);
  const onMoveTodoToArea = jest.fn().mockResolvedValue(true);

  renderWorkArea({ selectedTodoId: 't1', onMoveTodoToArea });
  await waitFor(() => expect(screen.getByText('Task')).toBeInTheDocument());

  await act(async () => { fireEvent.keyDown(document, { key: 'a' }); });
  expect(onMoveTodoToArea).toHaveBeenCalledWith(
    expect.objectContaining({ id: 't1' }),
    'left',
  );
});

test('pressing D calls onMoveTodoToArea with right direction', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([makeTodo('t1', 'Task', null, 0)]);
  jest.spyOn(todosApi, 'deleteTodo').mockResolvedValue(undefined);
  const onMoveTodoToArea = jest.fn().mockResolvedValue(true);

  renderWorkArea({ selectedTodoId: 't1', onMoveTodoToArea });
  await waitFor(() => expect(screen.getByText('Task')).toBeInTheDocument());

  await act(async () => { fireEvent.keyDown(document, { key: 'd' }); });
  expect(onMoveTodoToArea).toHaveBeenCalledWith(
    expect.objectContaining({ id: 't1' }),
    'right',
  );
});

test('keyboard shortcuts are suppressed when a text input is focused', async () => {
  jest.spyOn(todosApi, 'fetchTodos').mockResolvedValue([
    makeTodo('t1', 'First', null, 0),
    makeTodo('t2', 'Second', null, 1),
  ]);
  const onTodoSelect = jest.fn();
  renderWorkArea({ onTodoSelect });
  await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

  // Focus the text input (use .focus() so jsdom updates document.activeElement)
  const input = screen.getByRole('textbox', { name: /new todo/i });
  act(() => { input.focus(); });

  act(() => { fireEvent.keyDown(document, { key: 'ArrowDown' }); });
  expect(onTodoSelect).not.toHaveBeenCalled();
});
