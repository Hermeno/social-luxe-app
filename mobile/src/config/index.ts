// Single source of truth for API endpoints.
// In development, set EXPO_PUBLIC_API_URL in mobile/.env
// In production, set EXPO_PUBLIC_API_URL in your EAS build profile (eas.json → env)

export const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'https://luxe-la07.onrender.com'
export const API_URL    = `${API_BASE}/api/v1`
export const SOCKET_URL = API_BASE
