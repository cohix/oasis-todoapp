import React, { createRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TabBar, { TabBarHandle } from './TabBar';
import { WorkArea } from '../api/workAreas';

const makeArea = (id: string, name: string, position: number): WorkArea => ({
  id,
  name,
  position,
  created_at: '',
  updated_at: '',
});

const twoAreas: WorkArea[] = [
  makeArea('wa-1', 'Frontend', 0),
  makeArea('wa-2', 'Backend', 1),
];

function renderTabBar(overrides: Partial<{
  workAreas: WorkArea[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onReorder: (ordered: WorkArea[]) => Promise<void>;
  isShaking: boolean;
  onShakingEnd: () => void;
  ref?: React.Ref<TabBarHandle>;
}> = {}) {
  const props = {
    workAreas: twoAreas,
    activeId: 'wa-1',
    onSelect: jest.fn(),
    onCreate: jest.fn().mockResolvedValue(undefined),
    onRename: jest.fn().mockResolvedValue(undefined),
    onReorder: jest.fn().mockResolvedValue(undefined),
    isShaking: false,
    onShakingEnd: jest.fn(),
    ...overrides,
  };
  const { ref, ...rest } = props as any;
  const result = render(<TabBar ref={ref ?? null} {...rest} />);
  return { ...result, props };
}

afterEach(() => jest.restoreAllMocks());

// ---- Rendering ----

test('renders all work area tabs', () => {
  renderTabBar();
  expect(screen.getByRole('tab', { name: /frontend/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /backend/i })).toBeInTheDocument();
});

test('active tab has aria-selected=true', () => {
  renderTabBar({ activeId: 'wa-1' });
  const tab = screen.getByRole('tab', { name: /frontend/i });
  expect(tab).toHaveAttribute('aria-selected', 'true');
});

test('inactive tab has aria-selected=false', () => {
  renderTabBar({ activeId: 'wa-1' });
  const tab = screen.getByRole('tab', { name: /backend/i });
  expect(tab).toHaveAttribute('aria-selected', 'false');
});

test('renders the add work area button', () => {
  renderTabBar();
  expect(screen.getByRole('button', { name: /add work area/i })).toBeInTheDocument();
});

test('renders with empty work areas list', () => {
  renderTabBar({ workAreas: [] });
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add work area/i })).toBeInTheDocument();
});

// ---- Tab selection ----

test('calls onSelect when a tab is clicked', () => {
  const onSelect = jest.fn();
  renderTabBar({ onSelect });
  fireEvent.click(screen.getByRole('tab', { name: /backend/i }));
  expect(onSelect).toHaveBeenCalledWith('wa-2');
});

// ---- Create workflow ----

test('clicking add button shows the new-tab input', () => {
  renderTabBar();
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  expect(screen.getByRole('textbox', { name: /new work area name/i })).toBeInTheDocument();
});

test('pressing Enter with a name calls onCreate', async () => {
  const onCreate = jest.fn().mockResolvedValue(undefined);
  renderTabBar({ onCreate });
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  const input = screen.getByRole('textbox', { name: /new work area name/i });
  fireEvent.change(input, { target: { value: 'Mobile' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Mobile'));
});

test('pressing Enter with empty value cancels without calling onCreate', async () => {
  const onCreate = jest.fn().mockResolvedValue(undefined);
  renderTabBar({ onCreate });
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  const input = screen.getByRole('textbox', { name: /new work area name/i });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onCreate).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: /new work area name/i })).not.toBeInTheDocument()
  );
});

test('pressing Escape cancels creation without calling onCreate', () => {
  const onCreate = jest.fn();
  renderTabBar({ onCreate });
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  const input = screen.getByRole('textbox', { name: /new work area name/i });
  fireEvent.change(input, { target: { value: 'Oops' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onCreate).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox', { name: /new work area name/i })).not.toBeInTheDocument();
});

test('add button is disabled while create input is open', () => {
  renderTabBar();
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  expect(screen.getByRole('button', { name: /add work area/i })).toBeDisabled();
});

test('shows error message when onCreate rejects', async () => {
  const onCreate = jest.fn().mockRejectedValue(new Error('Duplicate name'));
  renderTabBar({ onCreate });
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  const input = screen.getByRole('textbox', { name: /new work area name/i });
  fireEvent.change(input, { target: { value: 'Frontend' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() =>
    expect(screen.getByText('Duplicate name')).toBeInTheDocument()
  );
});

// ---- Rename workflow ----

test('clicking Options then Rename shows the rename input pre-filled', () => {
  renderTabBar();
  fireEvent.click(screen.getByRole('button', { name: /options for frontend/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
  const input = screen.getByRole('textbox', { name: /rename work area/i });
  expect(input).toBeInTheDocument();
  expect((input as HTMLInputElement).value).toBe('Frontend');
});

test('pressing Enter in rename input calls onRename', async () => {
  const onRename = jest.fn().mockResolvedValue(undefined);
  renderTabBar({ onRename });
  fireEvent.click(screen.getByRole('button', { name: /options for frontend/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
  const input = screen.getByRole('textbox', { name: /rename work area/i });
  fireEvent.change(input, { target: { value: 'UI' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(onRename).toHaveBeenCalledWith('wa-1', 'UI'));
});

test('pressing Escape in rename input cancels rename', () => {
  const onRename = jest.fn();
  renderTabBar({ onRename });
  fireEvent.click(screen.getByRole('button', { name: /options for frontend/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
  const input = screen.getByRole('textbox', { name: /rename work area/i });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox', { name: /rename work area/i })).not.toBeInTheDocument();
});

test('shows error message when onRename rejects', async () => {
  const onRename = jest.fn().mockRejectedValue(new Error('Name taken'));
  renderTabBar({ onRename });
  fireEvent.click(screen.getByRole('button', { name: /options for frontend/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
  const input = screen.getByRole('textbox', { name: /rename work area/i });
  fireEvent.change(input, { target: { value: 'Backend' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Name taken')).toBeInTheDocument());
});

// ---- Drag and drop reorder ----

// jsdom doesn't implement dataTransfer; provide a stub so the component can set properties on it.
const mockDataTransfer = () => ({ effectAllowed: '', dropEffect: '' });

test('drop onto a different tab calls onReorder', () => {
  const onReorder = jest.fn().mockResolvedValue(undefined);
  renderTabBar({ onReorder });

  const tab1 = screen.getByRole('tab', { name: /frontend/i });
  const tab2 = screen.getByRole('tab', { name: /backend/i });

  fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer() });
  fireEvent.dragOver(tab2, { dataTransfer: mockDataTransfer() });
  fireEvent.drop(tab2, { dataTransfer: mockDataTransfer() });

  expect(onReorder).toHaveBeenCalled();
  // After drop the order should be swapped
  const call = onReorder.mock.calls[0][0] as WorkArea[];
  expect(call[0].id).toBe('wa-2');
  expect(call[1].id).toBe('wa-1');
});

test('dropping onto the same tab does not call onReorder', () => {
  const onReorder = jest.fn();
  renderTabBar({ onReorder });
  const tab1 = screen.getByRole('tab', { name: /frontend/i });
  fireEvent.dragStart(tab1, { dataTransfer: mockDataTransfer() });
  fireEvent.dragOver(tab1, { dataTransfer: mockDataTransfer() });
  fireEvent.drop(tab1, { dataTransfer: mockDataTransfer() });
  expect(onReorder).not.toHaveBeenCalled();
});

// ---- Keyboard navigation ----

test('applies tabbar--shaking class when isShaking is true', () => {
  renderTabBar({ isShaking: true });
  expect(document.querySelector('.tabbar--shaking')).toBeInTheDocument();
});

test('does not apply tabbar--shaking class when isShaking is false', () => {
  renderTabBar({ isShaking: false });
  expect(document.querySelector('.tabbar--shaking')).not.toBeInTheDocument();
});

test('calls onShakingEnd when the shake animation ends', () => {
  const onShakingEnd = jest.fn();
  renderTabBar({ isShaking: true, onShakingEnd });
  const tabbar = document.querySelector('.tabbar')!;
  fireEvent.animationEnd(tabbar);
  expect(onShakingEnd).toHaveBeenCalled();
});

test('ref exposes startCreating which opens the new-tab input', () => {
  const ref = createRef<TabBarHandle>();
  renderTabBar({ ref });
  expect(screen.queryByRole('textbox', { name: /new work area name/i })).not.toBeInTheDocument();

  act(() => { ref.current?.startCreating(); });
  expect(screen.getByRole('textbox', { name: /new work area name/i })).toBeInTheDocument();
});
