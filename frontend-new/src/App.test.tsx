import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import * as api from './api/workAreas';

// Suppress noisy "not wrapped in act" warnings from async state updates
beforeEach(() => {
  jest.spyOn(api, 'fetchWorkAreas').mockResolvedValue([]);
});

afterEach(() => jest.restoreAllMocks());

test('renders app name in top bar', async () => {
  render(<App />);
  expect(screen.getByText('todoapp')).toBeInTheDocument();
});

test('shows theme toggle button defaulting to light mode', async () => {
  render(<App />);
  expect(
    screen.getByRole('button', { name: /switch to dark mode/i })
  ).toBeInTheDocument();
});

test('toggles theme when toggle button is clicked', async () => {
  render(<App />);
  const btn = screen.getByRole('button', { name: /switch to dark mode/i });
  fireEvent.click(btn);
  expect(
    screen.getByRole('button', { name: /switch to light mode/i })
  ).toBeInTheDocument();
});

test('shows empty-state prompt when no work areas exist', async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText(/create a work area/i)).toBeInTheDocument()
  );
});

test('shows add-work-area button', async () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /add work area/i })).toBeInTheDocument();
});

test('shows work area tab after successful creation', async () => {
  const newArea: api.WorkArea = {
    id: '1',
    name: 'Design',
    position: 0,
    created_at: '',
    updated_at: '',
  };
  jest.spyOn(api, 'createWorkArea').mockResolvedValue(newArea);

  render(<App />);

  // Click '+' to open the new-tab input
  fireEvent.click(screen.getByRole('button', { name: /add work area/i }));
  const input = screen.getByRole('textbox', { name: /new work area name/i });
  fireEvent.change(input, { target: { value: 'Design' } });
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /design/i })).toBeInTheDocument()
  );
});
