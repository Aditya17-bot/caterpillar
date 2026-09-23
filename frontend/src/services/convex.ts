// Convex (cloud database for operator identity) is optional. With VITE_CONVEX_URL set in
// frontend/.env.local the login page reads operators from Convex; without it, it uses the
// operators from our FastAPI backend (or the built-in demo operators when that is offline).
export const CONVEX_URL: string | undefined = import.meta.env.VITE_CONVEX_URL || undefined
export const CONVEX_ENABLED = !!CONVEX_URL
