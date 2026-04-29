# Plan: Clerk Authentication for CineRadar Admin

## Current State

- **Next.js 16.2.4** (App Router) + React 19.2.5
- **No auth** — all routes are publicly accessible
- No `middleware.ts` / `proxy.ts` exists
- `DashboardLayout` wraps all pages with `Sidebar` (no auth-gating)
- API routes (`/api/*`) are completely open — no auth checks
- `layout.tsx` has `<DarkModeProvider>` → `<TooltipProvider>` → `<DashboardLayout>` provider chain
- Currently uses `src/` directory structure

## Why Clerk

- First-class Next.js App Router support (`clerkMiddleware`, `auth()`, `currentUser()`)
- Keyless mode for instant dev setup (no env vars needed to start)
- Pre-built sign-in/sign-up components (no custom UI needed)
- `UserButton` drop-in component for sidebar
- Server-side auth in API route handlers via `auth()`
- Role-based access control via Clerk Organizations
- Free tier: 10,000 MAU

## Scope

### Protected routes (require sign-in)
- All page routes: `/compare`, `/cinemas`, `/performances`, `/movies`, `/schedules`, `/scraper`, `/audit`, `/studios`
- All API routes: `/api/*`

### Public routes (no auth)
- `/` (root — will redirect to `/compare`, middleware handles auth redirect)
- Clerk's built-in sign-in/sign-up pages (`/sign-in/*`, `/sign-up/*`)

## Implementation Plan

### Phase 1: Core Setup (Infrastructure)

#### 1.1 Install Clerk

```bash
pnpm add @clerk/nextjs
```

#### 1.2 Create `src/proxy.ts` (Next.js 16 uses `proxy.ts`, not `middleware.ts`)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

Strategy: **Protect-all, opt-out public** — every route requires auth unless explicitly public. This is safer than the inverse.

#### 1.3 Wrap `layout.tsx` with `ClerkProvider`

```typescript
// layout.tsx — add ClerkProvider inside <body>, wrapping existing providers
import { ClerkProvider } from "@clerk/nextjs";

<body ...>
  <ClerkProvider>
    <DarkModeProvider>
      <TooltipProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </TooltipProvider>
    </DarkModeProvider>
  </ClerkProvider>
</body>
```

Provider order: `ClerkProvider` must be outermost (inside `<body>`).

#### 1.4 Environment Variables

Add to `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

For **dev**: Clerk's keyless mode auto-generates temporary keys — no env vars needed to start developing.

### Phase 2: UI Integration

#### 2.1 Add `UserButton` to Sidebar

Replace the current theme toggle section area. Add `UserButton` above the collapse button in `Sidebar.tsx`:

```typescript
import { UserButton } from '@clerk/nextjs'

// In the bottom section of Sidebar, add:
<UserButton afterSignOutUrl="/sign-in" />
```

The `UserButton` renders the user's avatar with a dropdown (profile, sign out, etc.).

#### 2.2 Custom Sign-In Page (Optional — Clerk provides defaults)

Clerk hosts sign-in/sign-up pages by default. If we want custom branding:

Create `src/app/sign-in/[[...sign-in]]/page.tsx`:
```typescript
import { SignIn } from '@clerk/nextjs'
export default function SignInPage() {
  return <SignIn />
}
```

Create `src/app/sign-up/[[...sign-up]]/page.tsx`:
```typescript
import { SignUp } from '@clerk/nextjs'
export default function SignUpPage() {
  return <SignUp />
}
```

These use Clerk's pre-built components with our app's layout/styling.

### Phase 3: API Route Protection

#### 3.1 Protect API Routes with `auth()`

For each API route handler, add auth check at the top:

```typescript
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  // ... existing route logic
}
```

#### 3.2 Files to Update

Every file in `src/app/api/`:
- `api/compare/route.ts`
- `api/debug/route.ts`
- `api/insights/route.ts`
- `api/movies/route.ts`
- `api/movies/[id]/route.ts`
- `api/performance/route.ts`
- `api/performance/[metadataId]/route.ts`
- `api/schedules/route.ts`
- `api/scraper/errors/route.ts`
- `api/scraper/today/route.ts`
- `api/showtimes/[showtimeId]/raw/route.ts`
- `api/studios/coverage/route.ts`
- `api/theatres/route.ts`
- `api/theatres/[id]/route.ts`
- `api/theatres/[id]/showtimes/route.ts`

### Phase 4: Role-Based Access (Future — Out of Scope for Initial Implementation)

Clerk supports Organizations with roles (`admin`, `viewer`). This could be used to:
- Restrict `/scraper` and `/api/scraper/*` to admin users only
- Make `/compare` and `/cinemas` read-only for viewers
- Add `auth.protect((has) => has({ permission: 'org:admin:scraper' }))` in middleware

This is **not** included in the initial implementation but the architecture supports it.

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@clerk/nextjs` dependency |
| `src/proxy.ts` | **Create** | Clerk middleware with protect-all strategy |
| `src/app/layout.tsx` | Modify | Wrap with `ClerkProvider` |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | **Create** | Custom sign-in page (optional) |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | **Create** | Custom sign-up page (optional) |
| `src/components/Sidebar.tsx` | Modify | Add `UserButton` component |
| `src/app/api/*/route.ts` | Modify | Add `auth()` check to all 15 API routes |
| `.env.local` | **Create** | Clerk env vars (or rely on keyless mode) |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Keyless mode dev keys are temporary | Claim the instance before deploying to production |
| `ClerkProvider` hydration issues | Clerk handles this natively with App Router |
| API route auth adds latency | `auth()` reads from the session token in the request — no external API call, <1ms overhead |
| Middleware runs on every request | This is standard; Clerk middleware is optimized for Edge runtime |

## Verification Checklist

After implementation:
1. [ ] Unauthenticated user visiting `/compare` → redirected to `/sign-in`
2. [ ] Sign-in with Clerk → redirected back to `/compare`
3. [ ] `UserButton` appears in sidebar with user avatar
4. [ ] API routes return 401 without valid session
5. [ ] API routes return data with valid session
6. [ ] Sign out → redirected to sign-in page
7. [ ] Dark mode preference persists across auth redirects
