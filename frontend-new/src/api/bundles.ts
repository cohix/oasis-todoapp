export interface Bundle {
  id: string;
  work_area_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export async function fetchBundles(workAreaId: string): Promise<Bundle[]> {
  const res = await fetch(`/api/v1/work-areas/${workAreaId}/bundles`);
  if (!res.ok) throw new Error('Failed to fetch bundles');
  return res.json();
}

export async function createBundle(workAreaId: string, name: string): Promise<Bundle> {
  const res = await fetch(`/api/v1/work-areas/${workAreaId}/bundles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create bundle');
  return res.json();
}

export async function updateBundle(id: string, name: string): Promise<Bundle> {
  const res = await fetch(`/api/v1/bundles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.status === 404) throw new Error('Bundle not found');
  if (!res.ok) throw new Error('Failed to update bundle');
  return res.json();
}

export async function deleteBundle(id: string): Promise<void> {
  const res = await fetch(`/api/v1/bundles/${id}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error('Bundle not found');
  if (!res.ok) throw new Error('Failed to delete bundle');
}
