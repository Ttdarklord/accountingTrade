import axios from 'axios'

// Get base URL with production fallback
const getBaseURL = () => {
  // Use environment variable if set
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  
  // Production fallback
  if (import.meta.env.PROD) {
    return 'https://accountingtrade.onrender.com/api';
  }
  
  // Development - use relative URLs with proxy
  return '/api';
};

const baseURL = getBaseURL();

// Helper function for direct fetch calls
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // In development, use relative URLs (Vite proxy handles them)
  if (import.meta.env.DEV) {
    return cleanEndpoint;
  }
  
  // In production, use full URL with /api prefix
  const backendUrl = import.meta.env.VITE_API_URL || 'https://accountingtrade.onrender.com';
  return `${backendUrl}${cleanEndpoint}`;
};

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies with cross-origin requests
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized
    } else if (error.response?.status >= 500) {
      // Handle server errors
      console.error('Server error:', error.response.data)
    }
    return Promise.reject(error)
  }
)

export default api 