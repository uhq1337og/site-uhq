// Simple client-side logger
(function(){
  function logEvent(type, payload) {
    try {
      fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload, ts: new Date().toISOString(), url: location.pathname })
      }).catch(()=>{
        console.warn('Log send failed');
      });
    } catch (e) { console.warn('logEvent error', e); }
  }

  function logError(msg, context = {}) {
    logEvent('error', { message: msg, context, url: location.pathname });
  }

  window.logEvent = logEvent;
  window.logError = logError;

  // Capture unhandled errors
  window.addEventListener('error', (e) => {
    logError(e.message, { filename: e.filename, lineno: e.lineno, colno: e.colno });
  });
})();
