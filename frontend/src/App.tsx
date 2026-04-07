import React, { useEffect, useRef, useState } from 'react';
import {
  WorkArea,
  fetchWorkAreas,
  createWorkArea,
  renameWorkArea,
  reorderWorkAreas,
} from './api/workAreas';
import { Todo, createTodo, updateTodo } from './api/todos';
import TabBar, { TabBarHandle } from './components/TabBar';
import WorkAreaPanel from './components/WorkArea';
import { isTextInputFocused } from './utils/keyboard';
import './App.css';

type Theme = 'light' | 'dark';

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [tabBarShaking, setTabBarShaking] = useState(false);

  const tabBarRef = useRef<TabBarHandle>(null);

  // Load work areas from the backend on mount
  useEffect(() => {
    fetchWorkAreas()
      .then(areas => {
        setWorkAreas(areas);
        if (areas.length > 0) setActiveId(areas[0].id);
      })
      .catch(() => setLoadError('Could not connect to the backend.'));
  }, []);

  // Global keydown: Left/Right (work area navigation) and N (new work area)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTextInputFocused()) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = workAreas.findIndex(a => a.id === activeId);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= workAreas.length) {
          setTabBarShaking(true);
        } else {
          setSelectedTodoId(null);
          setActiveId(workAreas[nextIdx].id);
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        tabBarRef.current?.startCreating();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [workAreas, activeId]);

  /**
   * Move a todo to an adjacent work area.
   * Creates the todo in the target area and returns true, or returns false
   * if no adjacent area exists in that direction.
   */
  async function handleMoveTodoToArea(todo: Todo, direction: 'left' | 'right'): Promise<boolean> {
    const idx = workAreas.findIndex(a => a.id === activeId);
    if (idx === -1) return false;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= workAreas.length) return false;

    const targetAreaId = workAreas[targetIdx].id;
    const created = await createTodo(targetAreaId, todo.title);
    if (todo.status !== 'todo') {
      await updateTodo({ ...created, status: todo.status });
    }
    return true;
  }

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  async function handleCreate(name: string) {
    const area = await createWorkArea(name);
    setWorkAreas(prev => [...prev, area]);
    setActiveId(area.id);
  }

  async function handleRename(id: string, name: string) {
    const updated = await renameWorkArea(id, name);
    setWorkAreas(prev => prev.map(a => (a.id === id ? updated : a)));
  }

  async function handleReorder(ordered: WorkArea[]) {
    // Optimistically update the UI
    setWorkAreas(ordered);
    await reorderWorkAreas(ordered.map((a, i) => ({ id: a.id, position: i })));
  }

  return (
    <div className={`app app--${theme}`}>
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar__name">todoapp</span>

        <TabBar
          ref={tabBarRef}
          workAreas={workAreas}
          activeId={activeId}
          onSelect={id => { setSelectedTodoId(null); setActiveId(id); }}
          onCreate={handleCreate}
          onRename={handleRename}
          onReorder={handleReorder}
          isShaking={tabBarShaking}
          onShakingEnd={() => setTabBarShaking(false)}
        />

        <button
          className="topbar__theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </header>

      {/* Main content */}
      <main className="main-content">
        {loadError ? (
          <p className="main-content__error">{loadError}</p>
        ) : workAreas.length === 0 ? (
          <p className="main-content__placeholder">
            Create a work area using the <strong>+</strong> button to get started.
          </p>
        ) : activeId ? (
          <WorkAreaPanel
            key={activeId}
            workAreaId={activeId}
            selectedTodoId={selectedTodoId}
            onTodoSelect={setSelectedTodoId}
            onMoveTodoToArea={handleMoveTodoToArea}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
