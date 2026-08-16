const originalError = console.error;
console.error = (...args: any[]) => {
  const isNetworkOrFetchError = args.some((arg: any) => {
    if (!arg) return false;
    const isStringMatch = (str: string) => 
      str.includes('Failed to fetch') || 
      str.includes('WebSocket') || 
      str.includes('realtime') ||
      str.includes('supabase');
      
    if (typeof arg === 'string' && isStringMatch(arg)) return true;
    if (arg.message && typeof arg.message === 'string' && isStringMatch(arg.message)) return true;
    if (arg.details && typeof arg.details === 'string' && isStringMatch(arg.details)) return true;
    
    try {
      const stringified = JSON.stringify(arg);
      if (isStringMatch(stringified)) return true;
    } catch (e) {}
    
    return false;
  });
  
  if (isNetworkOrFetchError) {
    console.warn('Network/Supabase Error: Could not connect to database (suppressed error).');
    return;
  }
  
  originalError(...args);
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason) {
    const isStringMatch = (str: string) => 
      str.includes('Failed to fetch') || 
      str.includes('WebSocket') || 
      str.includes('realtime') ||
      str.includes('supabase');
      
    if (typeof reason === 'string' && isStringMatch(reason)) {
      event.preventDefault(); // Stop it from surfacing
      console.warn('Suppressed unhandled fetch/websocket rejection');
      return;
    }
    if (reason.message && typeof reason.message === 'string' && isStringMatch(reason.message)) {
      event.preventDefault();
      console.warn('Suppressed unhandled fetch/websocket rejection');
      return;
    }
  }
});
