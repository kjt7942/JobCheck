export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  weather?: string;
  tmx?: string | number;
  tmn?: string | number;
}

export const fetchTasks = async (): Promise<Task[]> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/tasks`);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.tasks || [];
};

export const addTask = async (
  title: string, 
  date: string, 
  lat?: number, 
  lng?: number,
  weather?: string,
  tmx?: string | number,
  tmn?: string | number
): Promise<string> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, lat, lng, weather, tmx, tmn }),
  });
  if (!res.ok) throw new Error('Failed to add');
  const data = await res.json();
  return data.id;
};

export const toggleTask = async (id: string, completed: boolean): Promise<void> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/tasks`, {
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
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/tasks?id=${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete');
};

export const updateTask = async (id: string, updates: { title?: string; date?: string; completed?: boolean }): Promise<void> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update');
  }
};

export interface FarmSettings {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export const fetchSettings = async (): Promise<FarmSettings> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const updateSettings = async (settings: FarmSettings): Promise<void> => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
};
