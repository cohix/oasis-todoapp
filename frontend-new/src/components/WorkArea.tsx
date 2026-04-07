import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bundle, createBundle, fetchBundles, updateBundle } from '../api/bundles';
import { Todo, TodoStatus, createTodo, deleteTodo, fetchTodos, updateTodo } from '../api/todos';
import { isTextInputFocused } from '../utils/keyboard';
import BundleCard from './Bundle';
import TodoItem from './TodoItem';
import './WorkArea.css';

interface Props {
  workAreaId: string;
  selectedTodoId: string | null;
  onTodoSelect: (id: string | null) => void;
  onMoveTodoToArea: (todo: Todo, direction: 'left' | 'right') => Promise<boolean>;
}

interface DragState {
  todoId: string;
  fromBundleId: string | null;
}

export default function WorkArea({
  workAreaId,
  selectedTodoId,
  onTodoSelect,
  onMoveTodoToArea,
}: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  // dragOverTarget is either "todo:<id>", "bundle:<id>", or "ungroup"
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragState = useRef<DragState | null>(null);

  // Keyboard navigation state
  const [listShaking, setListShaking] = useState(false);
  const [errorTodoId, setErrorTodoId] = useState<string | null>(null);
  const [newTodoInputHighlighted, setNewTodoInputHighlighted] = useState(false);
  const newTodoInputRef = useRef<HTMLInputElement>(null);

  // Load data whenever the active work area changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [fetchedBundles, fetchedTodos] = await Promise.all([
        fetchBundles(workAreaId),
        fetchTodos(workAreaId),
      ]);
      if (!cancelled) {
        setBundles(fetchedBundles);
        setTodos(fetchedTodos);
      }
    }

    load().catch(console.error);
    return () => { cancelled = true; };
  }, [workAreaId]);

  // ---- Derived data ----

  // Map bundle id → its todos (in position order)
  const todosByBundle = bundles.reduce<Record<string, Todo[]>>((acc, b) => {
    acc[b.id] = todos
      .filter(t => t.bundle_id === b.id)
      .sort((a, b) => a.position - b.position);
    return acc;
  }, {});

  const ungroupedTodos = todos
    .filter(t => t.bundle_id === null)
    .sort((a, b) => a.position - b.position);

  // Flat ordered list matching visual render order: bundles first, then ungrouped
  const flatTodos = [
    ...bundles.flatMap(b => todosByBundle[b.id] ?? []),
    ...ungroupedTodos,
  ];

  // ---- New todo ----

  async function handleNewTodoKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const title = newTodoTitle.trim();
    if (!title) return;
    setNewTodoTitle('');
    const todo = await createTodo(workAreaId, title);
    setTodos(prev => [...prev, todo]);
  }

  // ---- Status change ----

  async function handleStatusChange(todo: Todo, status: TodoStatus) {
    const updated = await updateTodo({ ...todo, status });
    setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
  }

  // ---- Delete todo ----

  async function handleDeleteTodo(todoId: string) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    await deleteTodo(todoId);
    const removedBundleId = todo.bundle_id;
    setTodos(prev => prev.filter(t => t.id !== todoId));
    // If the bundle is now empty, remove it from local state too
    if (removedBundleId) {
      const remaining = todos.filter(
        t => t.id !== todoId && t.bundle_id === removedBundleId,
      );
      if (remaining.length === 0) {
        setBundles(prev => prev.filter(b => b.id !== removedBundleId));
      }
    }
  }

  // ---- Bundle rename ----

  async function handleBundleRename(bundleId: string, name: string) {
    const updated = await updateBundle(bundleId, name);
    setBundles(prev => prev.map(b => (b.id === bundleId ? updated : b)));
  }

  // ---- Drag & drop ----

  function handleDragStart(todoId: string) {
    const todo = todos.find(t => t.id === todoId) ?? null;
    dragState.current = { todoId, fromBundleId: todo?.bundle_id ?? null };
  }

  function handleDragEnd() {
    dragState.current = null;
    setDragOverTarget(null);
  }

  const handleDragOverTodo = useCallback((e: React.DragEvent, todoId: string) => {
    e.preventDefault();
    setDragOverTarget(`todo:${todoId}`);
  }, []);

  const handleDragOverBundle = useCallback((e: React.DragEvent, bundleId: string) => {
    e.preventDefault();
    setDragOverTarget(`bundle:${bundleId}`);
  }, []);

  const handleDragOverUngroup = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget('ungroup');
  }, []);

  // Drop on another todo: create a new bundle containing both, or add to existing bundle
  async function handleDropOnTodo(e: React.DragEvent, targetTodoId: string) {
    e.preventDefault();
    setDragOverTarget(null);
    const ds = dragState.current;
    if (!ds || ds.todoId === targetTodoId) return;

    const dragged = todos.find(t => t.id === ds.todoId);
    const target = todos.find(t => t.id === targetTodoId);
    if (!dragged || !target) return;

    if (target.bundle_id !== null) {
      // Add dragged todo to the target's existing bundle
      const updated = await updateTodo({ ...dragged, bundle_id: target.bundle_id });
      setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      cleanupEmptyBundle(ds.fromBundleId, updated.id);
    } else {
      // Neither is in a bundle (or dragged is leaving its bundle) → create a new bundle
      const newBundle = await createBundle(workAreaId, '');
      setBundles(prev => [...prev, newBundle]);
      const [updatedDragged, updatedTarget] = await Promise.all([
        updateTodo({ ...dragged, bundle_id: newBundle.id }),
        updateTodo({ ...target, bundle_id: newBundle.id }),
      ]);
      setTodos(prev =>
        prev.map(t => {
          if (t.id === updatedDragged.id) return updatedDragged;
          if (t.id === updatedTarget.id) return updatedTarget;
          return t;
        }),
      );
      cleanupEmptyBundle(ds.fromBundleId, updatedDragged.id);
    }
  }

  // Drop on a bundle's drop zone: add dragged todo to that bundle
  async function handleDropOnBundle(e: React.DragEvent, targetBundleId: string) {
    e.preventDefault();
    setDragOverTarget(null);
    const ds = dragState.current;
    if (!ds) return;
    const dragged = todos.find(t => t.id === ds.todoId);
    if (!dragged || dragged.bundle_id === targetBundleId) return;

    const updated = await updateTodo({ ...dragged, bundle_id: targetBundleId });
    setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    cleanupEmptyBundle(ds.fromBundleId, updated.id);
  }

  // Drop on the ungroup zone: remove the todo from its bundle
  async function handleDropOnUngroup(e: React.DragEvent) {
    e.preventDefault();
    setDragOverTarget(null);
    const ds = dragState.current;
    if (!ds || !ds.fromBundleId) return;
    const dragged = todos.find(t => t.id === ds.todoId);
    if (!dragged) return;

    const updated = await updateTodo({ ...dragged, bundle_id: null });
    setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    cleanupEmptyBundle(ds.fromBundleId, updated.id);
  }

  // Remove a bundle from local state if it has no todos left after a move
  function cleanupEmptyBundle(bundleId: string | null, movedTodoId: string) {
    if (!bundleId) return;
    const remaining = todos.filter(
      t => t.id !== movedTodoId && t.bundle_id === bundleId,
    );
    if (remaining.length === 0) {
      setBundles(prev => prev.filter(b => b.id !== bundleId));
    }
  }

  // ---- Keyboard navigation ----

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (isTextInputFocused()) return;

      // Up/Down — navigate the flat todo list
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (flatTodos.length === 0) return;

        if (selectedTodoId === null) {
          // No selection: Up → select last, Down → select first
          const target = e.key === 'ArrowUp'
            ? flatTodos[flatTodos.length - 1]
            : flatTodos[0];
          onTodoSelect(target.id);
          return;
        }

        const idx = flatTodos.findIndex(t => t.id === selectedTodoId);
        if (idx === -1) {
          onTodoSelect(flatTodos[0].id);
          return;
        }

        const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= flatTodos.length) {
          setListShaking(true);
        } else {
          onTodoSelect(flatTodos[nextIdx].id);
        }
        return;
      }

      // Escape — deselect
      if (e.key === 'Escape') {
        onTodoSelect(null);
        return;
      }

      // T — focus + highlight the new-todo input
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setNewTodoInputHighlighted(true);
        newTodoInputRef.current?.focus();
        return;
      }

      // W/S/A/D — require a selected todo
      if (!selectedTodoId) return;
      const todo = todos.find(t => t.id === selectedTodoId);
      if (!todo) return;

      // W — move toward top / into bundles
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (todo.bundle_id === null) {
          if (bundles.length > 0) {
            // Ungrouped → last bundle
            const targetBundle = bundles[bundles.length - 1];
            const updated = await updateTodo({ ...todo, bundle_id: targetBundle.id });
            setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
          } else {
            // No bundles: bundle with item above in ungrouped list
            const ungroupedIdx = ungroupedTodos.findIndex(t => t.id === todo.id);
            if (ungroupedIdx <= 0) {
              setListShaking(true);
            } else {
              const neighbor = ungroupedTodos[ungroupedIdx - 1];
              const newBundle = await createBundle(workAreaId, '');
              setBundles(prev => [...prev, newBundle]);
              const [updatedTodo, updatedNeighbor] = await Promise.all([
                updateTodo({ ...todo, bundle_id: newBundle.id }),
                updateTodo({ ...neighbor, bundle_id: newBundle.id }),
              ]);
              setTodos(prev =>
                prev.map(t => {
                  if (t.id === updatedTodo.id) return updatedTodo;
                  if (t.id === updatedNeighbor.id) return updatedNeighbor;
                  return t;
                }),
              );
            }
          }
        } else {
          const bundleIdx = bundles.findIndex(b => b.id === todo.bundle_id);
          if (bundleIdx <= 0) {
            setListShaking(true);
          } else {
            const targetBundle = bundles[bundleIdx - 1];
            const updated = await updateTodo({ ...todo, bundle_id: targetBundle.id });
            setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
          }
        }
        return;
      }

      // S — move toward bottom / out of bundles
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (todo.bundle_id === null) {
          if (bundles.length > 0) {
            // Ungrouped with bundles present → error
            setListShaking(true);
          } else {
            // No bundles: bundle with item below in ungrouped list
            const ungroupedIdx = ungroupedTodos.findIndex(t => t.id === todo.id);
            if (ungroupedIdx === -1 || ungroupedIdx >= ungroupedTodos.length - 1) {
              setListShaking(true);
            } else {
              const neighbor = ungroupedTodos[ungroupedIdx + 1];
              const newBundle = await createBundle(workAreaId, '');
              setBundles(prev => [...prev, newBundle]);
              const [updatedTodo, updatedNeighbor] = await Promise.all([
                updateTodo({ ...todo, bundle_id: newBundle.id }),
                updateTodo({ ...neighbor, bundle_id: newBundle.id }),
              ]);
              setTodos(prev =>
                prev.map(t => {
                  if (t.id === updatedTodo.id) return updatedTodo;
                  if (t.id === updatedNeighbor.id) return updatedNeighbor;
                  return t;
                }),
              );
            }
          }
        } else {
          const bundleIdx = bundles.findIndex(b => b.id === todo.bundle_id);
          if (bundleIdx < bundles.length - 1) {
            // Move to next bundle
            const targetBundle = bundles[bundleIdx + 1];
            const updated = await updateTodo({ ...todo, bundle_id: targetBundle.id });
            setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
          } else {
            // Last bundle → ungroup
            const updated = await updateTodo({ ...todo, bundle_id: null });
            cleanupEmptyBundle(todo.bundle_id, updated.id);
            setTodos(prev => prev.map(t => (t.id === updated.id ? updated : t)));
          }
        }
        return;
      }

      // A — move to work area on the left
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const moved = await onMoveTodoToArea(todo, 'left');
        if (moved) {
          await handleDeleteTodo(todo.id);
          onTodoSelect(null);
        } else {
          setErrorTodoId(todo.id);
        }
        return;
      }

      // D — move to work area on the right
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        const moved = await onMoveTodoToArea(todo, 'right');
        if (moved) {
          await handleDeleteTodo(todo.id);
          onTodoSelect(null);
        } else {
          setErrorTodoId(todo.id);
        }
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, bundles, selectedTodoId, workAreaId, flatTodos, ungroupedTodos]);

  const isDragging = dragState.current !== null;
  // Only show ungroup zone when the dragged todo is currently in a bundle
  const showUngroupZone = isDragging && dragState.current?.fromBundleId !== null;

  return (
    <div className="work-area">
      {/* Persistent new-todo input */}
      <div className="work-area__new-todo">
        <input
          ref={newTodoInputRef}
          className={[
            'work-area__new-todo-input',
            newTodoInputHighlighted ? 'work-area__new-todo-input--active' : '',
          ].filter(Boolean).join(' ')}
          type="text"
          placeholder="What needs to be done? (press Enter to add)"
          value={newTodoTitle}
          onChange={e => setNewTodoTitle(e.target.value)}
          onKeyDown={handleNewTodoKeyDown}
          onBlur={() => setNewTodoInputHighlighted(false)}
          aria-label="New todo"
        />
      </div>

      {/* Bundles and ungrouped todos — wrapped for shake animation */}
      <div
        className={['work-area__todos', listShaking ? 'work-area__todos--shaking' : ''].filter(Boolean).join(' ')}
        onAnimationEnd={() => setListShaking(false)}
      >
        {/* Bundles */}
        {bundles.map((bundle, idx) => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            colorIndex={idx}
            todos={todosByBundle[bundle.id] ?? []}
            draggingTodoId={dragState.current?.todoId ?? null}
            dragOverTarget={dragOverTarget}
            selectedTodoId={selectedTodoId}
            errorTodoId={errorTodoId}
            onDragStartTodo={handleDragStart}
            onDragOverTodo={handleDragOverTodo}
            onDropOnTodo={handleDropOnTodo}
            onDragOverBundle={handleDragOverBundle}
            onDropOnBundle={handleDropOnBundle}
            onDragEnd={handleDragEnd}
            onStatusChange={handleStatusChange}
            onDeleteTodo={handleDeleteTodo}
            onRename={handleBundleRename}
            onErrorAnimationEnd={id => { if (errorTodoId === id) setErrorTodoId(null); }}
          />
        ))}

        {/* Ungrouped todos */}
        {ungroupedTodos.length > 0 && (
          <div className="work-area__ungrouped">
            {ungroupedTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                isDragging={dragState.current?.todoId === todo.id}
                isDragOver={dragOverTarget === `todo:${todo.id}`}
                isSelected={selectedTodoId === todo.id}
                isError={errorTodoId === todo.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOverTodo}
                onDrop={handleDropOnTodo}
                onDragEnd={handleDragEnd}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTodo}
                onErrorAnimationEnd={() => { if (errorTodoId === todo.id) setErrorTodoId(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {todos.length === 0 && (
        <p className="work-area__empty">
          No todos yet — type above and press <strong>Enter</strong> to add one.
        </p>
      )}

      {/* Ungroup drop zone — shown only when dragging a bundled todo */}
      {showUngroupZone && (
        <div
          className={[
            'work-area__ungroup-zone',
            dragOverTarget === 'ungroup' ? 'work-area__ungroup-zone--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={handleDragOverUngroup}
          onDrop={handleDropOnUngroup}
          aria-label="Drop here to remove from bundle"
        >
          ✕ Remove from bundle
        </div>
      )}
    </div>
  );
}
