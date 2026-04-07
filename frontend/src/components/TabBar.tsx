import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WorkArea } from '../api/workAreas';
import './TabBar.css';

export interface TabBarHandle {
  startCreating: () => void;
}

interface Props {
  workAreas: WorkArea[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onReorder: (ordered: WorkArea[]) => Promise<void>;
  isShaking: boolean;
  onShakingEnd: () => void;
}

const TabBar = forwardRef<TabBarHandle, Props>(function TabBar({
  workAreas,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onReorder,
  isShaking,
  onShakingEnd,
}, ref) {
  // ID of the tab whose dropdown menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // ID of the tab currently being renamed (null = none)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Whether a new-tab input is being shown
  const [creatingNew, setCreatingNew] = useState(false);
  // Shared input value for both rename and create
  const [inputValue, setInputValue] = useState('');
  // Error message shown below the active input
  const [inputError, setInputError] = useState('');
  // Drag-and-drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input whenever it becomes visible
  useEffect(() => {
    if ((renamingId || creatingNew) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId, creatingNew]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  // ---- Handlers ----

  function startCreating() {
    setCreatingNew(true);
    setInputValue('');
    setInputError('');
  }

  // Expose startCreating to parent via ref
  useImperativeHandle(ref, () => ({ startCreating }));

  function cancelInput() {
    setCreatingNew(false);
    setRenamingId(null);
    setInputValue('');
    setInputError('');
  }

  async function commitCreate() {
    const name = inputValue.trim();
    if (!name) { cancelInput(); return; }
    try {
      await onCreate(name);
      setCreatingNew(false);
      setInputValue('');
      setInputError('');
    } catch (e: any) {
      setInputError(e.message ?? 'Error');
      inputRef.current?.focus();
    }
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = inputValue.trim();
    if (!name) { cancelInput(); return; }
    try {
      await onRename(renamingId, name);
      setRenamingId(null);
      setInputValue('');
      setInputError('');
    } catch (e: any) {
      setInputError(e.message ?? 'Error');
      inputRef.current?.focus();
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent, mode: 'create' | 'rename') {
    if (e.key === 'Enter') {
      e.preventDefault();
      mode === 'create' ? commitCreate() : commitRename();
    } else if (e.key === 'Escape') {
      cancelInput();
    }
  }

  function openMenu(e: React.MouseEvent, id: string) {
    e.stopPropagation(); // prevent document click from immediately closing it
    setOpenMenuId(prev => (prev === id ? null : id));
  }

  function startRename(id: string) {
    const area = workAreas.find(a => a.id === id);
    setOpenMenuId(null);
    setRenamingId(id);
    setInputValue(area?.name ?? '');
    setInputError('');
  }

  // ---- Drag & drop ----

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    // Recompute order
    const reordered = [...workAreas];
    const fromIdx = reordered.findIndex(a => a.id === draggedId);
    const toIdx = reordered.findIndex(a => a.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const withPositions = reordered.map((a, i) => ({ ...a, position: i }));
    setDraggedId(null);
    setDragOverId(null);
    onReorder(withPositions);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  // ---- Render ----

  return (
    <div
      className={['tabbar', isShaking ? 'tabbar--shaking' : ''].filter(Boolean).join(' ')}
      role="tablist"
      onAnimationEnd={onShakingEnd}
    >
      {workAreas.map(area => {
        const isActive = area.id === activeId;
        const isRenaming = renamingId === area.id;
        const isDragging = draggedId === area.id;
        const isDragOver = dragOverId === area.id;

        return (
          <div
            key={area.id}
            role="tab"
            aria-selected={isActive}
            className={[
              'tabbar__tab',
              isActive ? 'tabbar__tab--active' : '',
              isDragging ? 'tabbar__tab--dragging' : '',
              isDragOver ? 'tabbar__tab--dragover' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable
            onDragStart={e => handleDragStart(e, area.id)}
            onDragOver={e => handleDragOver(e, area.id)}
            onDrop={e => handleDrop(e, area.id)}
            onDragEnd={handleDragEnd}
            onClick={() => !isRenaming && onSelect(area.id)}
          >
            {isRenaming ? (
              <div className="tabbar__tab-input-wrap">
                <input
                  ref={inputRef}
                  className="tabbar__tab-input"
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setInputError(''); }}
                  onKeyDown={e => handleInputKeyDown(e, 'rename')}
                  onBlur={commitRename}
                  aria-label="Rename work area"
                />
                {inputError && <span className="tabbar__input-error">{inputError}</span>}
              </div>
            ) : (
              <span className="tabbar__tab-label">{area.name}</span>
            )}

            {/* '...' menu button — shown on hover via CSS */}
            {!isRenaming && (
              <div className="tabbar__menu-wrap">
                <button
                  className="tabbar__menu-btn"
                  aria-label={`Options for ${area.name}`}
                  onClick={e => openMenu(e, area.id)}
                >
                  ···
                </button>
                {openMenuId === area.id && (
                  <ul className="tabbar__dropdown" role="menu">
                    <li
                      role="menuitem"
                      className="tabbar__dropdown-item"
                      onClick={() => startRename(area.id)}
                    >
                      Rename
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* New tab input */}
      {creatingNew && (
        <div className="tabbar__tab tabbar__tab--creating">
          <div className="tabbar__tab-input-wrap">
            <input
              ref={inputRef}
              className="tabbar__tab-input"
              value={inputValue}
              placeholder="Work area name"
              onChange={e => { setInputValue(e.target.value); setInputError(''); }}
              onKeyDown={e => handleInputKeyDown(e, 'create')}
              onBlur={cancelInput}
              aria-label="New work area name"
            />
            {inputError && <span className="tabbar__input-error">{inputError}</span>}
          </div>
        </div>
      )}

      {/* Add tab button */}
      <button
        className="tabbar__add-btn"
        onClick={startCreating}
        aria-label="Add work area"
        title="Add work area"
        disabled={creatingNew}
      >
        +
      </button>
    </div>
  );
});

export default TabBar;
