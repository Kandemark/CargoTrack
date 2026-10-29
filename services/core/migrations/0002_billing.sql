-- Prepaid wallets. All amounts are integer cents of KES: no floating point
-- anywhere near money.
--
-- A wallet balance is only ever changed by billing.Store, which writes one
-- ledger entry per change in the same transaction. The CHECK constraint
-- means no bug, race, or manual UPDATE can take a balance below zero.

CREATE TABLE meters (
    code             text        PRIMARY KEY,
    name             text        NOT NULL,
    description      text        NOT NULL DEFAULT '',
    unit_price_cents bigint      NOT NULL CHECK (unit_price_cents >= 0),
    active           boolean     NOT NULL DEFAULT true,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
    org_id        uuid        PRIMARY KEY REFERENCES organizations (id),
    balance_cents bigint      NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
    id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id              uuid        NOT NULL REFERENCES wallets (org_id),
    kind                text        NOT NULL CHECK (kind IN ('topup', 'charge', 'adjustment')),
    amount_cents        bigint      NOT NULL CHECK (amount_cents <> 0),
    balance_after_cents bigint      NOT NULL CHECK (balance_after_cents >= 0),
    meter_code          text        REFERENCES meters (code),
    quantity            integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents    bigint,
    -- Idempotency key, e.g. 'topup:<id>' or 'adjust:<bank ref>'.
    reference           text        UNIQUE,
    description         text        NOT NULL DEFAULT '',
    actor_user_id       uuid        REFERENCES users (id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'charge') = (meter_code IS NOT NULL))
);
CREATE INDEX ledger_entries_org_id_idx ON ledger_entries (org_id, id DESC);

CREATE TABLE topups (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           uuid        NOT NULL REFERENCES wallets (org_id),
    reference_code   text        NOT NULL UNIQUE,
    provider         text        NOT NULL,
    provider_ref     text        NOT NULL DEFAULT '',
    amount_cents     bigint      NOT NULL CHECK (amount_cents > 0),
    -- Only a masked number is kept (2547****678): it identifies the payer
    -- on a receipt without storing personal data we do not need.
    phone_masked     text        NOT NULL DEFAULT '',
    status           text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'succeeded', 'failed')),
    failure_reason   text        NOT NULL DEFAULT '',
    created_by       uuid        REFERENCES users (id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    last_checked_at  timestamptz,
    credited_at      timestamptz
);
CREATE INDEX topups_org_id_idx ON topups (org_id, created_at DESC);
CREATE UNIQUE INDEX topups_provider_ref_idx ON topups (provider, provider_ref) WHERE provider_ref <> '';

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON wallets USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ledger_entries USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

ALTER TABLE topups ENABLE ROW LEVEL SECURITY;
ALTER TABLE topups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON topups USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

-- Starting prices. The platform owner changes them through
-- PUT /v1/admin/meters/{code}; later migrations must not overwrite them.
INSERT INTO meters (code, name, description, unit_price_cents) VALUES
    ('shipment.create', 'Shipment',
     'Creating a shipment. Covers every tracking event for that shipment.', 5000),
    ('prediction.run', 'Prediction',
     'One run of a prediction: delay, demand, pricing, theft risk, border delay.', 500),
    ('document.ocr', 'Document OCR',
     'Reading one uploaded document (bill of lading, invoice, permit).', 2000);
