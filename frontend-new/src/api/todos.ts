export type TodoStatus = 'todo' | 'in_progress' | 'completed';

export interface Todo {
  id: string;
  work_area_id: string;
  bundle_id: string | null;
  title: string;
  status: TodoStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

export async function fetchTodos(workAreaId: string): Promise<Todo[]> {
  const res = await fetch(`/api/v1/work-areas/${workAreaId}/todos`);
  if (!res.ok) throw new Error('Failed to fetch todos');
  return res.json();
}

export async function createTodo(workAreaId: string, title: string): Promise<Todo> {
  const res = await fetch(`/api/v1/work-areas/${workAreaId}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to create todo');
  return res.json();
}

export async function updateTodo(todo: Todo): Promise<Todo> {
  const res = await fetch(`/api/v1/todos/${todo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: todo.title,
      status: todo.status,
      bundle_id: todo.bundle_id,
      position: todo.position,
    }),
  });
  if (res.status === 404) throw new Error('Todo not found');
  if (!res.ok) throw new Error('Failed to update todo');
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch(`/api/v1/todos/${id}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error('Todo not found');
  if (!res.ok) throw new Error('Failed to delete todo');
}
