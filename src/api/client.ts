export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  weather?: string;
  tmx?: string | number;
  tmn?: string | number;
  groupId?: string;
}

export interface FarmSettings {
  name: string;
  region: string;
  lat: number;
  lng: number;
  weekStartsOn?: 0 | 1; // 0: Sunday, 1: Monday
  theme?: 'light' | 'dark';
}

// 🌐 Helper: Centralized API Request Handler
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${baseUrl}/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${res.status}`);
  }

  return res.json();
}

export const fetchTasks = async (): Promise<Task[]> => {
  const data = await apiRequest<{ tasks: Task[] }>('/tasks');
  return data.tasks || [];
};

export const addTask = async (
  title: string, 
  date: string, 
  lat?: number, 
  lng?: number,
  weather?: string,
  tmx?: string | number,
  tmn?: string | number,
  groupId?: string
): Promise<string> => {
  const data = await apiRequest<{ id: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, date, lat, lng, weather, tmx, tmn, groupId }),
  });
  return data.id;
};

export const toggleTask = async (id: string, completed: boolean): Promise<void> => {
  await apiRequest('/tasks', {
    method: 'PATCH',
    body: JSON.stringify({ id, completed }),
  });
};

export const deleteTask = async (id: string): Promise<void> => {
  // Delete ignores body, uses query param by convention here
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  await fetch(`${baseUrl}/api/tasks?id=${id}`, { method: 'DELETE' });
};

export const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
  await apiRequest('/tasks', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...updates }),
  });
};

export const fetchSettings = async (): Promise<FarmSettings> => {
  return apiRequest<FarmSettings>('/settings');
};

export const updateSettings = async (settings: FarmSettings): Promise<void> => {
  await apiRequest('/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
};
