// Simple boot monitor: logs to console & reports errors to server
function report(path: string, payload: any) {
  try {
    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

// Mark start
performance.mark?.('client_boot_start');

// Global error hooks
window.addEventListener('error', (e) => {
  report('window.error', { type: 'error', message: e.message, stack: e.error?.stack });
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  report('window.unhandledrejection', { type: 'unhandledrejection', message: String(e.reason), stack: (e.reason as any)?.stack });
});

// Hydration marker
export function markHydrated() {
  performance.mark?.('client_boot_hydrated');
  const start = performance.getEntriesByName('client_boot_start')[0] as PerformanceMark | undefined;
  const hydrated = performance.getEntriesByName('client_boot_hydrated')[0] as PerformanceMark | undefined;
  const delta = start && hydrated ? hydrated.startTime - start.startTime : undefined;
  report('hydrated', { type: 'hydrated', durationMS: delta });
}

// Initial ping so we know script executed at all
report('boot-script-loaded', { type: 'boot', ts: Date.now() });

// If nothing else happens in 8s, send failure beacon
setTimeout(() => {
  const hydrated = performance.getEntriesByName('client_boot_hydrated')[0];
  if (!hydrated) {
    report('hydration-timeout', { type: 'hydration-timeout', ts: Date.now() });
  }
}, 8000);
