const BASE = '/api/v1/work-areas';

export interface WorkArea {
  id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ReorderItem {
  id: string;
  position: number;
}

export async function fetchWorkAreas(): Promise<WorkArea[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to fetch work areas');
  return res.json();
}

export async function createWorkArea(name: string): Promise<WorkArea> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.status === 409) throw new Error('A work area with that name already exists');
  if (!res.ok) throw new Error('Failed to create work area');
  return res.json();
}

export async function renameWorkArea(id: string, name: string): Promise<WorkArea> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.status === 404) throw new Error('Work area not found');
  if (res.status === 409) throw new Error('A work area with that name already exists');
  if (!res.ok) throw new Error('Failed to rename work area');
  return res.json();
}

export async function reorderWorkAreas(items: ReorderItem[]): Promise<void> {
  const res = await fetch(`${BASE}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('Failed to reorder work areas');
}
