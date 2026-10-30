-- Vehicles and drivers, and assigning them to shipments.
--
-- Assignment foreign keys include org_id, so the database itself refuses
-- to put one organisation's truck or driver on another organisation's
-- shipment. (Foreign-key checks ignore row-level security; the composite
-- key is what makes them tenant-safe.) Carriers from other organisations
-- will be brought in through accepted marketplace jobs, not by ID.

CREATE TABLE vehicles (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                uuid        NOT NULL REFERENCES organizations (id),
    -- As written on the plate, e.g. "KDA 123A"; matching uses registration_key.
    registration          text        NOT NULL CHECK (registration <> ''),
    registration_key      text        NOT NULL,
    kind                  text        NOT NULL CHECK (kind IN
                              ('prime_mover', 'rigid_truck', 'trailer', 'van', 'pickup', 'motorbike')),
    capacity_kg           numeric(10, 2) CHECK (capacity_kg > 0),
    insurance_expires_on  date,
    inspection_expires_on date,
    active                boolean     NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, id),
    UNIQUE (org_id, registration_key)
);

CREATE TABLE drivers (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid        NOT NULL REFERENCES organizations (id),
    -- Set when the driver first signs in with a verified email matching
    -- email below.
    user_id             uuid        UNIQUE REFERENCES users (id),
    name                text        NOT NULL CHECK (name <> ''),
    email               text        NOT NULL DEFAULT '',
    phone               text        NOT NULL DEFAULT '',
    licence_number      text        NOT NULL CHECK (licence_number <> ''),
    licence_expires_on  date        NOT NULL,
    active              boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, id),
    CHECK (email = lower(email))
);
CREATE UNIQUE INDEX drivers_org_email_idx ON drivers (org_id, email) WHERE email <> '';

ALTER TABLE shipments
    ADD COLUMN vehicle_id uuid,
    ADD COLUMN driver_id  uuid,
    ADD FOREIGN KEY (org_id, vehicle_id) REFERENCES vehicles (org_id, id),
    ADD FOREIGN KEY (org_id, driver_id)  REFERENCES drivers (org_id, id);
CREATE INDEX shipments_driver_idx ON shipments (driver_id) WHERE driver_id IS NOT NULL;

ALTER TABLE shipment_events DROP CONSTRAINT shipment_events_kind_check;
ALTER TABLE shipment_events ADD CONSTRAINT shipment_events_kind_check
    CHECK (kind IN ('status', 'checkpoint', 'delay', 'note', 'assignment'));

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vehicles USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON drivers USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));
