import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TodoItem from './TodoItem';
import { Todo } from '../api/todos';

const baseTodo: Todo = {
  id: 'todo-1',
  work_area_id: 'wa-1',
  bundle_id: null,
  title: 'Write tests',
  status: 'todo',
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function renderTodo(overrides: Partial<Todo> = {}, handlers: Partial<{
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onStatusChange: (todo: Todo, status: any) => void;
  onDelete: (id: string) => void;
}> = {}) {
  const todo = { ...baseTodo, ...overrides };
  const props = {
    todo,
    isDragging: false,
    isDragOver: false,
    onDragStart: jest.fn(),
    onDragOver: jest.fn(),
    onDrop: jest.fn(),
    onDragEnd: jest.fn(),
    onStatusChange: jest.fn(),
    onDelete: jest.fn(),
    ...handlers,
  };
  const result = render(<TodoItem {...props} />);
  return { ...result, props };
}

// ---- Rendering ----

test('renders the todo title', () => {
  renderTodo();
  expect(screen.getByText('Write tests')).toBeInTheDocument();
});

test('renders status dot with correct aria-label for todo status', () => {
  renderTodo({ status: 'todo' });
  expect(screen.getByLabelText('Status: To Do')).toBeInTheDocument();
});

test('renders status dot with correct aria-label for in_progress status', () => {
  renderTodo({ status: 'in_progress' });
  expect(screen.getByLabelText('Status: In Progress')).toBeInTheDocument();
});

test('renders status dot with correct aria-label for completed status', () => {
  renderTodo({ status: 'completed' });
  expect(screen.getByLabelText('Status: Done')).toBeInTheDocument();
});

test('applies status class to container', () => {
  const { container } = renderTodo({ status: 'in_progress' });
  expect(container.firstChild).toHaveClass('todo-item--in_progress');
});

test('applies dragging class when isDragging is true', () => {
  const { container } = render(
    <TodoItem
      todo={baseTodo}
      isDragging={true}
      isDragOver={false}
      onDragStart={jest.fn()}
      onDragOver={jest.fn()}
      onDrop={jest.fn()}
      onDragEnd={jest.fn()}
      onStatusChange={jest.fn()}
      onDelete={jest.fn()}
    />
  );
  expect(container.firstChild).toHaveClass('todo-item--dragging');
});

test('applies dragover class when isDragOver is true', () => {
  const { container } = render(
    <TodoItem
      todo={baseTodo}
      isDragging={false}
      isDragOver={true}
      onDragStart={jest.fn()}
      onDragOver={jest.fn()}
      onDrop={jest.fn()}
      onDragEnd={jest.fn()}
      onStatusChange={jest.fn()}
      onDelete={jest.fn()}
    />
  );
  expect(container.firstChild).toHaveClass('todo-item--dragover');
});

// ---- Status transition buttons ----

test('todo status shows In Progress and Done buttons', () => {
  renderTodo({ status: 'todo' });
  expect(screen.getByRole('button', { name: /mark as in progress/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /mark as done/i })).toBeInTheDocument();
});

test('in_progress status shows To Do and Done buttons', () => {
  renderTodo({ status: 'in_progress' });
  expect(screen.getByRole('button', { name: /mark as to do/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /mark as done/i })).toBeInTheDocument();
});

test('completed status shows To Do and In Progress buttons', () => {
  renderTodo({ status: 'completed' });
  expect(screen.getByRole('button', { name: /mark as to do/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /mark as in progress/i })).toBeInTheDocument();
});

// ---- Callbacks ----

test('calls onStatusChange with correct status when transition button clicked', () => {
  const onStatusChange = jest.fn();
  renderTodo({ status: 'todo' }, { onStatusChange });
  fireEvent.click(screen.getByRole('button', { name: /mark as in progress/i }));
  expect(onStatusChange).toHaveBeenCalledWith(baseTodo, 'in_progress');
});

test('calls onDelete with todo id when delete button clicked', () => {
  const onDelete = jest.fn();
  renderTodo({}, { onDelete });
  fireEvent.click(screen.getByRole('button', { name: /delete todo/i }));
  expect(onDelete).toHaveBeenCalledWith('todo-1');
});

test('calls onDragStart with todo id on drag start', () => {
  const onDragStart = jest.fn();
  const { container } = renderTodo({}, { onDragStart });
  // No dataTransfer access in TodoItem's onDragStart; plain event is sufficient.
  fireEvent.dragStart(container.firstChild as Element);
  expect(onDragStart).toHaveBeenCalledWith('todo-1');
});

test('calls onDragEnd on drag end', () => {
  const onDragEnd = jest.fn();
  const { container } = renderTodo({}, { onDragEnd });
  fireEvent.dragEnd(container.firstChild as Element);
  expect(onDragEnd).toHaveBeenCalled();
});

// ---- Delete button ----

test('renders delete button', () => {
  renderTodo();
  expect(screen.getByRole('button', { name: /delete todo/i })).toBeInTheDocument();
});
