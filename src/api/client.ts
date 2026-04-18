export type Task = {
  id: string;
  title: string;
  completed: boolean;
  date: string;
};

export const fetchTasks = async (): Promise<Task[]> => {
  const res = await fetch('/api/tasks');
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.tasks || [];
};

export const addTask = async (title: string, date: string): Promise<string> => {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date }),
  });
  if (!res.ok) throw new Error('Failed to add');
  const data = await res.json();
  return data.id;
};

export const toggleTask = async (id: string, completed: boolean): Promise<void> => {
  const res = await fetch('/api/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, completed }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to toggle');
  }
};

export const deleteTask = async (id: string): Promise<void> => {
  const res = await fetch(`/api/tasks?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete');
};
