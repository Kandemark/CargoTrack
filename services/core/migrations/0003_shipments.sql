-- Shipments and their history.
--
-- A shipment belongs to the organisation that booked (and paid for) it.
-- Carriers from other organisations will see shipments assigned to them
-- through the fleet module; until then only the owner sees a shipment.

CREATE TABLE shipments (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Monotonic, for stable newest-first pagination; never shown to clients.
    seq                  bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    org_id               uuid        NOT NULL REFERENCES organizations (id),
    tracking_number      text        NOT NULL UNIQUE,
    -- The client's own reference: PO number, booking number, job file.
    reference            text        NOT NULL DEFAULT '',
    status               text        NOT NULL DEFAULT 'booked' CHECK (status IN
                             ('booked', 'picked_up', 'in_transit', 'customs', 'exception', 'delivered', 'cancelled')),

    origin_name          text        NOT NULL CHECK (origin_name <> ''),
    origin_country       char(2)     NOT NULL,
    destination_name     text        NOT NULL CHECK (destination_name <> ''),
    destination_country  char(2)     NOT NULL,

    cargo_description    text        NOT NULL DEFAULT '',
    weight_kg            numeric(10, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 200000),
    pieces               integer     NOT NULL DEFAULT 1 CHECK (pieces > 0),

    pickup_at            timestamptz NOT NULL,
    deliver_by           timestamptz NOT NULL,
    picked_up_at         timestamptz,
    delivered_at         timestamptz,

    -- Client-supplied Idempotency-Key of the creating request, so a retried
    -- request returns the same shipment instead of booking (and charging)
    -- a second one.
    idempotency_key      text,
    -- Hash of the creating request's contents: the same key with different
    -- contents is a client bug and is refused, not silently answered with
    -- the earlier shipment.
    idempotency_fingerprint text,
    created_by           uuid        REFERENCES users (id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CHECK (deliver_by > pickup_at),
    UNIQUE (org_id, idempotency_key)
);
CREATE INDEX shipments_org_seq_idx ON shipments (org_id, seq DESC);
CREATE INDEX shipments_org_status_idx ON shipments (org_id, status);

CREATE TABLE shipment_events (
    id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shipment_id  uuid        NOT NULL REFERENCES shipments (id),
    org_id       uuid        NOT NULL REFERENCES organizations (id),
    kind         text        NOT NULL CHECK (kind IN ('status', 'checkpoint', 'delay', 'note')),
    from_status  text,
    to_status    text,
    location     text        NOT NULL DEFAULT '',
    latitude     double precision CHECK (latitude BETWEEN -90 AND 90),
    longitude    double precision CHECK (longitude BETWEEN -180 AND 180),
    note         text        NOT NULL DEFAULT '',
    -- Only shown to the owning organisation, never on public tracking.
    internal     boolean     NOT NULL DEFAULT false,
    occurred_at  timestamptz NOT NULL DEFAULT now(),
    recorded_by  uuid        REFERENCES users (id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'status') = (to_status IS NOT NULL)),
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX shipment_events_shipment_idx ON shipment_events (shipment_id, occurred_at, id);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shipments USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shipment_events USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));
