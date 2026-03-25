## Progress Update - 2026-03-25

### Done
- Updated `README.md` with a full beginner-friendly documentation section.
- Added a complete project tree in a visual style similar to the requested image.
- Added a database structure tree in `README.md`.
- Added column data types (DataType) in the database tree section.
- Reorganized the database section for better readability (details/tables).
- Documented the purpose of each file currently موجود in the repository (frontend + backend + configs + assets).
- Fixed dev API URL selection in `api/config.ts` to respect `EXPO_PUBLIC_USE_API=true` (prevents Expo Go using a derived local URL).
- Added a place search bar on `app/(main)/map.tsx` to filter visible locations and highlight matching markers.
- Fixed `map.tsx` runtime crash by removing reliance on `useMemo` during place search filtering.

### Notes
- Files referenced in workflow rules (`CYCLE.md`, `AGENTS.md`, `PLAN.md`, `agent.md`) were not found in this repository root at execution time.

### NEXT AGENT
- QA/Review Agent: verify the map screen loads without `useMemo` runtime errors and that place search filtering + marker highlight still work.
