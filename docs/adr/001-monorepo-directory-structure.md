# ADR 001: Monorepo Directory Structure

**Status:** Accepted  
**Date:** 2026-05-13  
**Author:** Claude (AI-assisted restructuring)

## Context

The monorepo previously used `apps/` as the top-level directory for client-facing applications (web, mobile). This naming was ambiguous in a B2B logistics context where "apps" could refer to Django applications (17 domain apps in `services/api/`) or mobile applications.

The directory also contained dead code (`apps/shared/` duplicated `libs/shared-types/`) and several files were misplaced at the repository root.

## Decision

### `apps/` → `frontends/`

| Candidate | Rejected because |
|---|---|
| `clients` | In logistics, "clients" means customers (shippers, carriers) |
| `interfaces` | In logistics, "interfaces" means EDI gateways (AS2, EDIFACT, X12) |
| `platforms` | Suggests deployment targets (AWS, GCP) rather than user-facing apps |
| `frontends` | **Selected** — unambiguous across all domains; standard in Nx, Turborepo, Metaverse |

### Root cleanup

| File | Action | Reason |
|---|---|---|
| `apps/shared/` | Deleted | Dead code; zero imports; duplicated `libs/shared-types/` |
| `index.js` | Deleted | Stale Metro bundler workaround |
| `app.json` | Deleted | Stale Expo config with wrong package name |
| `conftest.py` | Moved to `services/api/tests/` | Django fixtures belong with Django code |
| `pytest.ini` | Moved to `services/api/` | pytest config belongs with Python code |

### Language version upgrades

| Language | Old | New | Rationale |
|---|---|---|---|
| Rust edition | 2021 | 2024 | Stable since Rust 1.85 |
| Go | 1.22 | 1.24 | Latest stable; backward-compatible |
| Java | 21 | 21 (unchanged) | Current LTS; Spring Boot 3.4 target |
| TypeScript (web) | 6.0.2 | 6.0.2 (unchanged) | Already latest |
| TypeScript (mobile) | 5.9.2 | 5.9.2 (unchanged) | Expo SDK 54 constraint |

## Target Structure

```
cargotrack/
├── frontends/          # Client-facing applications
│   ├── mobile/         # Expo SDK 54 (React Native)
│   └── web/            # React 19 + Vite 8 SPA
├── libs/               # Shared libraries and types
│   ├── api-client/
│   ├── design-tokens/
│   ├── proto/
│   ├── rust-core/
│   └── shared-types/
├── services/           # Backend microservices
├── infrastructure/     # IaC (was deploy/ — deferred)
├── coturn/             # TURN/STUN server config
├── docs/
└── scripts/
```

## Consequences

- All path references updated across 20+ files (package.json, Makefile, docker-compose files, CI workflows, documentation)
- Workspace configuration in root `package.json` updated to `["frontends/*", "libs/*"]`
- `apps/shared/` deleted; both web and mobile already resolved `@shared` to `libs/shared-types/`
- Relative path aliases in tsconfig, vite config, metro config, babel config survive rename unchanged
- `deploy/` → `infrastructure/` rename deferred to a separate change due to high blast radius (25+ references)
