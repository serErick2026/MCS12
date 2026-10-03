const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json();
}

export function getHealth() {
  return request('/health');
}
