import React from 'react';
import { Todo, TodoStatus } from '../api/todos';
import './TodoItem.css';

interface Props {
  todo: Todo;
  isDragging: boolean;
  isDragOver: boolean;
  isSelected?: boolean;
  isError?: boolean;
  onDragStart: (todoId: string) => void;
  onDragOver: (e: React.DragEvent, todoId: string) => void;
  onDrop: (e: React.DragEvent, todoId: string) => void;
  onDragEnd: () => void;
  onStatusChange: (todo: Todo, status: TodoStatus) => void;
  onDelete: (todoId: string) => void;
  onErrorAnimationEnd?: () => void;
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Done',
};

const STATUS_NEXT: Record<TodoStatus, TodoStatus[]> = {
  todo: ['in_progress', 'completed'],
  in_progress: ['todo', 'completed'],
  completed: ['todo', 'in_progress'],
};

export default function TodoItem({
  todo,
  isDragging,
  isDragOver,
  isSelected = false,
  isError = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onStatusChange,
  onDelete,
  onErrorAnimationEnd,
}: Props) {
  return (
    <div
      className={[
        'todo-item',
        `todo-item--${todo.status}`,
        isDragging ? 'todo-item--dragging' : '',
        isDragOver ? 'todo-item--dragover' : '',
        isSelected ? 'todo-item--selected' : '',
        isError ? 'todo-item--error' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onAnimationEnd={isError ? onErrorAnimationEnd : undefined}
      draggable
      onDragStart={() => onDragStart(todo.id)}
      onDragOver={e => onDragOver(e, todo.id)}
      onDrop={e => onDrop(e, todo.id)}
      onDragEnd={onDragEnd}
    >
      {/* Status indicator */}
      <span
        className={`todo-item__status-dot todo-item__status-dot--${todo.status}`}
        title={STATUS_LABELS[todo.status]}
        aria-label={`Status: ${STATUS_LABELS[todo.status]}`}
      />

      <span className="todo-item__title">{todo.title}</span>

      {/* Action buttons — shown on hover via CSS */}
      <div className="todo-item__actions">
        {STATUS_NEXT[todo.status].map(next => (
          <button
            key={next}
            className={`todo-item__action-btn todo-item__action-btn--${next}`}
            onClick={() => onStatusChange(todo, next)}
            title={STATUS_LABELS[next]}
            aria-label={`Mark as ${STATUS_LABELS[next]}`}
          >
            {STATUS_LABELS[next]}
          </button>
        ))}
        <button
          className="todo-item__action-btn todo-item__action-btn--delete"
          onClick={() => onDelete(todo.id)}
          title="Delete"
          aria-label="Delete todo"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
