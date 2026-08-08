// Single source of truth for API endpoints.
// In development, set EXPO_PUBLIC_API_URL in mobile/.env when testing on device.
// In production, EXPO_PUBLIC_API_URL must be set in the EAS build profile.

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim()

if (!configuredApiUrl && !__DEV__) {
  throw new Error('EXPO_PUBLIC_API_URL is required for production builds')
}

export const API_BASE   = (configuredApiUrl || 'http://localhost:3000').replace(/\/$/, '')
export const API_URL    = `${API_BASE}/api/v1`
export const SOCKET_URL = API_BASE
