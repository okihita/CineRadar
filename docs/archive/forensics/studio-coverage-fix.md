# Plan: Studio Coverage Fix & Layout Intelligence Enhancements

## Objective
Fix the "999 / 1,000" studio count discrepancy caused by Firestore pagination bugs and finalize UI/API enhancements for cinema layout intelligence.

## Implementation Steps
1. Fix Firestore REST client pagination in `admin/src/lib/firestore-rest.ts`.
2. Redesign `StudioCoverageCard.tsx` and update coverage API route.
3. Fix lint/type errors in `admin` and `backend` packages.
4. Add `backend/scripts/recover_v2_studios.py`.
