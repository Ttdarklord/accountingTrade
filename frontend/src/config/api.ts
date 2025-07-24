// API Configuration for different environments

const getApiBaseUrl = (): string => {
  // In production, if VITE_API_URL is set, use it
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    console.log('🔧 Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  // Production fallback - use the known backend URL
  if (import.meta.env.PROD) {
    console.log('🔧 Using production fallback URL: https://accountingtrade.onrender.com');
    return 'https://accountingtrade.onrender.com';
  }
  
  // In development, use relative URLs which will work with Vite proxy
  console.log('🔧 Using development relative URLs');
  return '';
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

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',
  USERS: '/api/auth/users',
  ACTIVITY_LOGS: '/api/auth/activity-logs',
  
  // Core entities
  TRADES: '/api/trades',
  PARTIES: '/api/parties',
  ACCOUNTS: '/api/accounts',
  RECEIPTS: '/api/receipts',
  COUNTERPARTS: '/api/counterparts',
  DASHBOARD: '/api/dashboard',
  JOURNAL: '/api/journal',
  SETTLEMENTS: '/api/settlements',
  
  // Health check
  HEALTH: '/api/health'
} as const;

// Environment info
export const ENV_INFO = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL,
  mode: import.meta.env.MODE,
  computedApiUrl: API_BASE_URL
}; 