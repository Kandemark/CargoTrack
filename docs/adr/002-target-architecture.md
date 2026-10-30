# ADR 002: Target Architecture: One Language per Runtime Profile

**Status:** Accepted
**Date:** 2026-10-29
**Author:** Kandemark

## Context

CargoTrack has no production data and no paying clients yet, so the existing code is treated as a prototype, not a constraint. The business model is a prepaid wallet: organisations top up KES credit (M-Pesa first) and paid actions are deducted from it. The platform owner never pays infrastructure out of pocket, so hosting cost per request is margin.

The prototype splits services by business domain (11 backend services, 41 compose services) while the business logic in them shares one database and needs shared transactions: a wallet charge must commit with the shipment it pays for. Its Django core also showed a class of bug that is fatal for a multi-tenant B2B platform: a query helper that returned every tenant's rows when a user had no organisation.

## Decision

Split deployables by **runtime profile**, not by domain, and give each profile the language built for it.

| Deployable | Language | Owns | Why this language |
|---|---|---|---|
| `services/core` | Go | Organisations, billing, payments; then shipments, fleet, marketplace, customs, documents, notifications, webhooks as internal modules | Network services, simple enough for a 7–8 person team, single static binary, millisecond start for scale-to-zero hosting |
| `services/geo` | Rust | GPS/IoT ingest, map-matching, geofences, ETA, route/fuel/load optimisation | CPU-bound and high-volume; the cost that grows fastest with every truck |
| `services/realtime` | Elixir / Phoenix | Live positions, chat, presence | The BEAM holds very many lightweight connections cheaply |
| `services/edi` | Java + Apache Camel | EDIFACT, X12, AS2 | The only mature EDI ecosystem; deployed only once an EDI contract exists |
| `services/intelligence` | Python | OCR and ML, when there is data to train on | Where Python is the best tool |
| `frontends/app` | TypeScript, Expo Router (React Native + React Native Web), plus a native Kotlin location module | Every feature, on web, Android and iOS from one codebase | Web and mobile must have the same features; one set of screens makes that true by construction and halves front-end work. Native Kotlin only where budget Android phones kill background GPS |

Bought, not built: Zitadel (identity, B2B organisations), Temporal (durable workflows, replacing Camunda 7), NATS JetStream (events, replacing Kafka), LiveKit (video), Postgres with PostGIS and TimescaleDB, Valkey (cache).

### Rules for `services/core`

1. **Tenant isolation is enforced by Postgres row-level security.** Every tenant table has the `tenant_isolation` policy. Handlers acting for a user run in `database.InOrg`; only provider callbacks, provisioning and platform administration use `database.AsSystem`. A transaction that sets neither sees no tenant rows, so a forgotten scope fails closed.
2. **Money is integer KES cents.** No floating point anywhere near money.
3. **Paid actions call `billing.Service.Charge` inside the action's own transaction**, just before commit. No credit means a 402 and the action rolls back.
4. **Credit is released only on a provider's answer to an authenticated status query**, never on what a callback says.
5. **Migrations only move forward** and are embedded in the binary.

### Frontend: one app for web and mobile (amended 2026-10-29)

Every feature on the web is on mobile too: nothing may be possible only on the web because the app lacks it. The platforms may look and work differently. Data, API calls, permissions and business rules are shared, which is what keeps features equal. A screen gets a separate web version (`screen.web.tsx` next to `screen.tsx`) wherever that serves desktop users better, for example a dense table on the web and a thumb-friendly list on the phone.

- **Phone:** four or five bottom tabs chosen by role (a driver sees Jobs; a manager sees Shipments, Fleet, Marketplace, Wallet), with the rest reachable through search and a More screen.
- **Wide screens:** a sidebar and denser tables.
- **Design:** typography and space first, one accent colour plus status colours, no borders, shadows or glass on every element, high contrast for sunlight, English and Swahili.

The previous mobile app (32 drawer screens, about 109 hard-coded colours) failed on information architecture, not on how many features it had.

## Consequences

- The prototype services are retired module by module as `core` replaces them. `services/api` (Django) is removed once its last module has moved.
- Contracts live in `contracts/`: OpenAPI for the public API, protobuf for service-to-service calls.
- Five backend deployables instead of eleven; fewer moving parts to host and secure.
- Rust and Elixir developers are scarcer than Go developers, which is why those languages are limited to the two services that need them.
