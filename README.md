<div align="center">

<img src="docs/assets/logo.png" width="96" alt="CargoTrack" />

# CargoTrack

**Freight booking, tracking and fleet operations for East Africa, paid for as you use it.**

[![Core](https://github.com/Kandemark/CargoTrack/actions/workflows/core.yml/badge.svg)](https://github.com/Kandemark/CargoTrack/actions/workflows/core.yml)
[![App](https://github.com/Kandemark/CargoTrack/actions/workflows/app.yml/badge.svg)](https://github.com/Kandemark/CargoTrack/actions/workflows/app.yml)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8)](services/core/go.mod)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-58-000020)](frontends/app/package.json)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)

[Overview](#overview) ·
[Features](#features) ·
[Architecture](#architecture) ·
[Quick start](#quick-start) ·
[Documentation](#documentation) ·
[Roadmap](#roadmap) ·
[Contributing](#contributing)

</div>

---

## Overview

CargoTrack connects shippers, freight forwarders, carriers and their drivers across Kenya, Uganda, Tanzania, Rwanda and Burundi. Shippers book and follow shipments, carriers win loads on an open marketplace and run them with their own trucks, and consignees track deliveries without an account.

The platform is **prepaid**. Each organisation tops up a KES wallet with M-Pesa, and paid actions such as booking a shipment are deducted from it. An action without credit behind it does not run. CargoTrack never holds freight money: what a shipper pays a carrier is settled between the two companies.

> **Status.** The platform is being rebuilt from an earlier prototype. The Go core and the app described here are the new system; the prototype services still in the repository are marked [legacy](#legacy-prototype) and are retired as their replacements land. There is no production data yet.

## Features

| Area | What it does | Status |
|---|---|---|
| **Wallet and billing** | Prepaid KES wallet; per-action prices set by the platform owner; append-only ledger; HTTP 402 when credit runs out | Built |
| **M-Pesa top-ups** | STK Push; credit released only after Safaricom confirms over an authenticated query; lost callbacks recovered automatically | Built |
| **Shipments** | Paid, idempotent booking; enforced status rules (booked, picked up, in transit, customs, delivered); full history | Built |
| **Public tracking** | Consignees follow a shipment by tracking number without signing in; private details never shown | Built |
| **Fleet** | Vehicles and drivers with insurance, inspection and licence dates; non-compliant ones cannot be assigned | Built |
| **Marketplace** | Shippers list loads, carriers bid (sealed), the accepted carrier operates the shipment with its own fleet | Built |
| **App (web, Android, iOS)** | One codebase, equal features on every platform, English and Swahili | In progress: sign-in, wallet, top-up, account |
| **Live GPS, geofences, ETA** | High-volume device ingest and route intelligence | Planned |
| **Realtime** | Live map positions, chat, presence | Planned |
| **EDI** | EDIFACT, X12 and AS2 with shipping lines, ports and customs | Planned, when a contract needs it |

## Architecture

Deployables are split by how they behave at runtime, and each is written in the language built for that job. The full reasoning is in [ADR 002](docs/adr/002-target-architecture.md).

```mermaid
flowchart LR
    subgraph Clients
        APP["App<br/>web · Android · iOS"]
        TRACK["Public tracking"]
    end
    subgraph Platform
        CORE["core (Go)<br/>orgs · billing · shipments<br/>fleet · marketplace"]
        GEO["geo (Rust)<br/>GPS · geofences · ETA"]
        RT["realtime (Elixir)<br/>live map · chat"]
        PG[("PostgreSQL<br/>row-level security")]
        NATS{{"NATS JetStream"}}
    end
    ZIT["Zitadel<br/>identity"]
    MPESA["M-Pesa Daraja"]

    APP --> CORE
    TRACK --> CORE
    APP -. sign in .-> ZIT
    CORE --> PG
    CORE <--> MPESA
    GEO --> NATS --> RT --> APP
    NATS --> CORE
```

| Component | Technology | Responsibility | Status |
|---|---|---|---|
| [`services/core`](services/core) | Go, PostgreSQL | Business API: organisations, billing, payments, shipments, fleet, marketplace | Built |
| [`frontends/app`](frontends/app) | TypeScript, Expo Router, React Native | Every feature on web, Android and iOS | In progress |
| `services/geo` | Rust | GPS and IoT ingest, map-matching, geofences, ETA, optimisation | Planned |
| `services/realtime` | Elixir, Phoenix | Live positions, chat, presence | Planned |
| `services/edi` | Java, Apache Camel | EDI with shipping lines, ports and customs | Planned |
| [`contracts/openapi`](contracts/openapi/core.v1.yaml) | OpenAPI 3.1 | The public API; the app's types are generated from it | Built |

### Guarantees

These are enforced by the database or the build, not by convention:

- **Tenant isolation.** PostgreSQL row-level security scopes every query to the caller's organisation. A query that forgets to filter returns nothing, never another company's data.
- **Money.** All amounts are integer KES cents. A wallet balance cannot go below zero, a paid action and its charge commit together, and a retried request is never charged twice.
- **Payments.** Callbacks from payment providers are never trusted on their own. Credit is released only on the provider's answer to an authenticated status query.
- **Cross-company safety.** A shipment can only be assigned trucks and drivers from the fleet operating it; the foreign keys include the organisation.
- **App start-up.** Release builds must point at hosted HTTPS servers or the build fails, and nothing on the network can hold the app on its splash screen.

## Quick start

### Requirements

| Tool | Version | For |
|---|---|---|
| Go | 1.25+ | `services/core` |
| PostgreSQL | 17+ | running the core and its tests |
| Node.js | 24+ | `frontends/app` |
| Expo Go | matching SDK 58 | previewing the app on a phone |

### Core API

```sh
cd services/core
export DATABASE_URL=postgres://core:core@localhost:5432/core
export OIDC_ISSUER=https://<instance>.zitadel.cloud
export OIDC_AUDIENCE=<zitadel project id>
go run ./cmd/core            # applies migrations, serves :8080
```

Tests run against real PostgreSQL as an ordinary (non-superuser) role, so row-level security is exercised exactly as in production:

```sh
export CORE_TEST_DATABASE_URL=postgres://core_test:<password>@localhost:5432/core_test
go test -race ./...
```

Configuration, Zitadel and M-Pesa setup: [`services/core/README.md`](services/core/README.md).

### App

```sh
cd frontends/app
npm ci
cp .env.example .env.local   # fill in the API and Zitadel addresses
npx expo start               # scan the QR code with Expo Go, or press w for web
```

Release builds, environments and checks: [`frontends/app/README.md`](frontends/app/README.md).

## Repository layout

```
contracts/openapi/     Public API contract (OpenAPI 3.1)
services/core/         Go business API (new system)
frontends/app/         Expo app for web, Android and iOS (new system)
docs/adr/              Architecture decision records
.github/workflows/     CI: core.yml, app.yml, and the legacy ci.yml

services/api/          Legacy: Django prototype
services/*             Legacy: prototype microservices, retired as replaced
frontends/web/         Legacy: React prototype
frontends/mobile/      Legacy: Expo prototype
```

## Documentation

| Document | Covers |
|---|---|
| [ADR 001: Monorepo directory structure](docs/adr/001-monorepo-directory-structure.md) | Folder naming |
| [ADR 002: Target architecture](docs/adr/002-target-architecture.md) | Languages per runtime profile, rules for the core, equal features on web and mobile |
| [Core service](services/core/README.md) | Layout, rules, configuration, roles, Zitadel and M-Pesa setup |
| [App](frontends/app/README.md) | Structure, start-up rules, environments, release builds |
| [API contract](contracts/openapi/core.v1.yaml) | Every endpoint, schema and error code |

### Legacy prototype

These documents describe the earlier Django-based prototype and are kept for reference while it is retired: [architecture](docs/architecture.md), [services](docs/services.md), [API reference](docs/api-reference.md), [data models](docs/data-models.md), [features](docs/features.md), [development](docs/development.md), [deployment](docs/deployment.md), [webhook events](docs/webhook-events.md).

## Roadmap

- [x] Core: organisations, prepaid wallet, M-Pesa top-ups
- [x] Core: shipments, public tracking
- [x] Core: fleet and assignment
- [x] Core: freight marketplace
- [ ] App: shipments, fleet and marketplace screens
- [ ] Hosting: core and database on managed, pay-as-you-go infrastructure
- [ ] App: first release build on Android
- [ ] Geo service: live GPS from trucks, geofences, ETA
- [ ] Realtime service: live map and chat
- [ ] Retire the legacy prototype

## Contributing

1. Branch from `main` and open a pull request; `main` changes only through reviewed pull requests.
2. Keep each commit to one change, with a message in the form `type: summary` (`feat`, `fix`, `docs`, `test`, `ci`).
3. Before pushing, run the checks for what you changed:
   - Core: `gofmt -l .`, `go vet ./...`, `go test -race ./...`
   - App: `npx tsc --noEmit`, `npx eslint .`, `npm run gen:api` (no diff), `npx expo-doctor`
4. A change to the API starts in [`contracts/openapi/core.v1.yaml`](contracts/openapi/core.v1.yaml); regenerate the app's types in the same pull request.
5. Decisions that shape the system are recorded as an ADR in [`docs/adr`](docs/adr).

## License

CargoTrack is licensed under the [GNU Affero General Public License v3.0](LICENSE).
