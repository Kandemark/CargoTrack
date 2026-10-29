# core

CargoTrack's business API in Go. Today: organisations, prepaid billing, and M-Pesa top-ups. Shipments, fleet, marketplace and customs follow as modules of this same service. See [ADR 002](../../docs/adr/002-target-architecture.md) for why.

The API contract is [`contracts/openapi/core.v1.yaml`](../../contracts/openapi/core.v1.yaml).

## Layout

```
cmd/core/            main: wiring, HTTP server, shutdown
migrations/          SQL, applied in order at startup, embedded in the binary
internal/
  platform/          shared plumbing, no business logic
    config/          every environment variable, in one file
    database/        pool, migrations, InOrg / AsSystem transactions
    auth/            Zitadel token verification, roles and permissions
    httpx/           JSON helpers and the one error shape
    testkit/         real Postgres and a fake Zitadel for tests
  orgs/              mirrors Zitadel organisations and users; GET /v1/me
  billing/           wallets, ledger, meters, top-ups, reconciler
  payments/          the Provider interface
    mpesa/           Safaricom Daraja (STK Push + Query)
```

## Rules

- **Never query tenant data outside `db.InOrg`.** Row-level security does the scoping; a query in `db.AsSystem` sees every organisation and is only for provider callbacks, first-login provisioning and platform administration.
- **Money is `int64` cents.** Names end in `_cents`.
- **Bill a paid action with `billing.Service.Charge(ctx, tx, principal, meter, qty, desc)`** in the action's own transaction, after its writes. Return its error: a 402 rolls the action back.
- **New meters are added by migration** (`INSERT INTO meters ...`), never by changing an existing migration.

## Running locally

```sh
export DATABASE_URL=postgres://core:core@localhost:5432/core
export OIDC_ISSUER=https://<your-instance>.zitadel.cloud
export OIDC_AUDIENCE=<zitadel project id>
go run ./cmd/core
```

Without `MPESA_*` set, the service runs but refuses top-ups.

## Tests

Tests run against real Postgres, so row-level security is tested exactly as it runs in production. They are skipped unless `CORE_TEST_DATABASE_URL` is set, and they refuse a superuser role (superusers bypass row-level security).

```sh
createuser core_test --pwprompt          # an ordinary role, not a superuser
createdb core_test --owner core_test
export CORE_TEST_DATABASE_URL=postgres://core_test:<password>@localhost:5432/core_test
go test -race ./...
```

Each test gets its own schema, dropped afterwards.

## Zitadel setup

1. Create a project; its ID is `OIDC_AUDIENCE`.
2. In the project, enable **Assert Roles on Authentication** and add the role keys `platform_owner`, `org_admin`, `finance`, `operations`, `driver`.
3. Create the web and mobile applications with **Auth Token Type: JWT**. Opaque tokens are rejected.
4. Each client company is a Zitadel organisation; grant the project to it and assign roles to its users. `platform_owner` is granted only in your own organisation.

| Role | Can |
|---|---|
| `platform_owner` | everything, set prices, adjust any wallet; never billed |
| `org_admin`, `finance` | see the wallet and ledger, top up |
| `operations` | see the wallet and ledger |
| `driver` | no billing access |

## M-Pesa (Daraja)

| Variable | Value |
|---|---|
| `MPESA_ENVIRONMENT` | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` | from the Daraja app |
| `MPESA_SHORTCODE`, `MPESA_PASSKEY` | Paybill/Till shortcode and its Lipa Na M-Pesa passkey (sandbox: `174379`) |
| `MPESA_CALLBACK_TOKEN` | a long random string |
| `MPESA_CALLBACK_URL` | `https://<core host>/v1/payments/mpesa/callback?token=<MPESA_CALLBACK_TOKEN>` |

Daraja callbacks are unsigned. A callback without the token is dropped; a callback with it only triggers an STK Push Query, and credit is released on Safaricom's answer to that query. Pending top-ups whose callback never arrives are re-checked every minute and marked failed after 24 hours.

If Daraja cannot be reached when a top-up starts, the top-up is marked failed with its reference code. Should money arrive anyway (it carries that code as the account reference), credit it with `POST /v1/admin/organizations/{id}/adjustments` using the M-Pesa receipt number as `reference`.

## Other settings

| Variable | Default | |
|---|---|---|
| `CORE_HTTP_ADDR` | `:8080` | |
| `BILLING_MIN_TOPUP_KES` | `100` | smallest top-up accepted |
| `BILLING_LOW_BALANCE_KES` | `500` | below this the wallet reports `low_balance` |
| `BILLING_TOPUP_CHECK_SECONDS` | `5` | minimum gap between provider checks when a customer polls |
