// API Configuration for different environments

const getApiBaseUrl = (): string => {
  // In production, if VITE_API_URL is set, use it
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    console.log('🔧 Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  
  // Production fallback - use the known backend URL
  if (import.meta.env.PROD) {
    console.log('🔧 Using production fallback URL: https://accountingtrade.onrender.com/api');
    return 'https://accountingtrade.onrender.com/api';
  }
  
  // In development, use relative URLs which will work with Vite proxy
  console.log('🔧 Using development relative URLs');
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Log the final computed URL for debugging
console.log('🌐 Final API Base URL:', API_BASE_URL);
console.log('🌐 Environment:', {
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
  MODE: import.meta.env.MODE,
  VITE_API_URL: import.meta.env.VITE_API_URL
});

// Helper function to create full API URLs
export const createApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If API_BASE_URL is empty, return relative URL
  if (!API_BASE_URL) {
    return cleanEndpoint;
  }
  
  // Return full URL
  return `${API_BASE_URL}${cleanEndpoint}`;
};

// Common API endpoints (these will now automatically get /api prefix)
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
  USERS: '/auth/users',
  ACTIVITY_LOGS: '/auth/activity-logs',
  
  // Core entities
  TRADES: '/trades',
  PARTIES: '/parties',
  ACCOUNTS: '/accounts',
  RECEIPTS: '/receipts',
  COUNTERPARTS: '/counterparts',
  DASHBOARD: '/dashboard',
  JOURNAL: '/journal',
  SETTLEMENTS: '/settlements',
  
  // Health check
  HEALTH: '/health'
} as const;

// Environment info
export const ENV_INFO = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL,
  mode: import.meta.env.MODE,
  computedApiUrl: API_BASE_URL
}; 