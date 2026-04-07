import React, { useEffect, useRef, useState } from 'react';
import { Bundle } from '../api/bundles';
import { Todo, TodoStatus } from '../api/todos';
import TodoItem from './TodoItem';
import './Bundle.css';

interface Props {
  bundle: Bundle;
  colorIndex: number;
  todos: Todo[];
  draggingTodoId: string | null;
  dragOverTarget: string | null;
  selectedTodoId: string | null;
  errorTodoId: string | null;
  onDragStartTodo: (todoId: string) => void;
  onDragOverTodo: (e: React.DragEvent, todoId: string) => void;
  onDropOnTodo: (e: React.DragEvent, todoId: string) => void;
  onDragOverBundle: (e: React.DragEvent, bundleId: string) => void;
  onDropOnBundle: (e: React.DragEvent, bundleId: string) => void;
  onDragEnd: () => void;
  onStatusChange: (todo: Todo, status: TodoStatus) => void;
  onDeleteTodo: (todoId: string) => void;
  onRename: (bundleId: string, name: string) => void;
  onErrorAnimationEnd: (todoId: string) => void;
}

export default function BundleCard({
  bundle,
  colorIndex,
  todos,
  draggingTodoId,
  dragOverTarget,
  selectedTodoId,
  errorTodoId,
  onDragStartTodo,
  onDragOverTodo,
  onDropOnTodo,
  onDragOverBundle,
  onDropOnBundle,
  onDragEnd,
  onStatusChange,
  onDeleteTodo,
  onRename,
  onErrorAnimationEnd,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(bundle.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  // Start editing immediately if the bundle was just created with no name
  useEffect(() => {
    if (bundle.name === '') setEditingName(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitName() {
    const trimmed = nameValue.trim();
    setEditingName(false);
    onRename(bundle.id, trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    if (e.key === 'Escape') { setEditingName(false); setNameValue(bundle.name); }
  }

  const isDraggingOver = dragOverTarget === `bundle:${bundle.id}`;
  const isDragging = draggingTodoId !== null;

  return (
    <section
      className={`bundle bundle--color-${colorIndex % 6}`}
      aria-label={`Bundle: ${bundle.name || 'Unnamed bundle'}`}
    >
      {/* Bundle header */}
      <div className="bundle__header">
        {editingName ? (
          <input
            ref={inputRef}
            className="bundle__name-input"
            value={nameValue}
            placeholder="Bundle name"
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitName}
            aria-label="Bundle name"
          />
        ) : (
          <>
            <span className="bundle__name">{bundle.name || 'Unnamed bundle'}</span>
            <button
              className="bundle__rename-btn"
              onClick={() => { setNameValue(bundle.name); setEditingName(true); }}
              title="Rename bundle"
              aria-label="Rename bundle"
            >
              ✏️
            </button>
          </>
        )}
      </div>

      {/* Todos in this bundle */}
      <div className="bundle__todos">
        {todos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            isDragging={draggingTodoId === todo.id}
            isDragOver={dragOverTarget === `todo:${todo.id}`}
            isSelected={selectedTodoId === todo.id}
            isError={errorTodoId === todo.id}
            onDragStart={onDragStartTodo}
            onDragOver={onDragOverTodo}
            onDrop={onDropOnTodo}
            onDragEnd={onDragEnd}
            onStatusChange={onStatusChange}
            onDelete={onDeleteTodo}
            onErrorAnimationEnd={() => onErrorAnimationEnd(todo.id)}
          />
        ))}
      </div>

      {/* Drop zone — always present but visually active only when dragging */}
      <div
        className={[
          'bundle__drop-zone',
          isDragging ? 'bundle__drop-zone--visible' : '',
          isDraggingOver ? 'bundle__drop-zone--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={e => onDragOverBundle(e, bundle.id)}
        onDrop={e => onDropOnBundle(e, bundle.id)}
        aria-label={`Drop here to add to ${bundle.name}`}
      >
        Add to bundle
      </div>
    </section>
  );
}
