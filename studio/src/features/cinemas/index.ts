/**
 * Cinemas feature barrel export
 * 
 * DESIGN PATTERN: Only export types and server-safe utilities here.
 * Client hooks and components should be imported directly from their files
 * to avoid "use client" leakage into server components.
 */

// Types
export * from './types';

// Utils
export { getStudioDisplayName } from './utils';

// NOTE: DO NOT export client components or hooks here if they are imported by Server Components.
// Server components like app/cinemas/[id]/page.tsx should import components directly.
