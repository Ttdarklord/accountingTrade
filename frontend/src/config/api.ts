// API Configuration for different environments

const getApiBaseUrl = (): string => {
  // In production, if VITE_API_URL is set, use it
  // Otherwise, use relative URLs (same domain)
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development or when no explicit API URL is set,
  // use relative URLs which will work with Vite proxy
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

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
  mode: import.meta.env.MODE
}; 