import { getHealth } from './services/api.js';
import { isConfigured } from './config/env.js';

function setStatus(id, label, state) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = label;
  element.className = `status ${state}`;
}

async function init() {
  setStatus('config-status', isConfigured() ? 'Configured' : 'Not configured', isConfigured() ? 'ok' : 'warn');

  try {
    const health = await getHealth();
    setStatus('api-status', health.status === 'ok' ? 'Online' : 'Unexpected', health.status === 'ok' ? 'ok' : 'warn');
  } catch {
    setStatus('api-status', 'Offline', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
