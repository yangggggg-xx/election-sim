const backend = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const API_BASE = backend + '/api';

export async function fetchEvents() {
  const res = await fetch(`${API_BASE}/events`);
  return res.json();
}

export async function addEvent(event: { title: string; date: string; content: string; domain?: string; country?: string }) {
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return res.json();
}

export async function deleteEvent(id: string) {
  const res = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function updateEvent(id: string, updates: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function loadPreset() {
  const res = await fetch(`${API_BASE}/events/preset`, { method: 'POST' });
  return res.json();
}

export async function fetchAgents(state?: string) {
  const url = state ? `${API_BASE}/agents?state=${state}` : `${API_BASE}/agents`;
  const res = await fetch(url);
  return res.json();
}

export async function fetchFactors() {
  const res = await fetch(`${API_BASE}/factors`);
  return res.json();
}

export async function updateFactors(factors: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/factors`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(factors),
  });
  return res.json();
}

export async function fetchState() {
  const res = await fetch(`${API_BASE}/state`);
  return res.json();
}

export async function fetchPrediction() {
  const res = await fetch(`${API_BASE}/prediction`);
  return res.json();
}

export function createSimWebSocket(): WebSocket {
  return new WebSocket(backend.replace(/^http/, 'ws') + '/ws/simulate');
}

