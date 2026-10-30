-- Freight marketplace: shippers list booked shipments, carriers from other
-- organisations bid, and the accepted carrier operates the shipment.
--
-- CargoTrack never holds the freight money: the bid price is agreed here
-- and paid between the two companies directly. Holding it would make
-- CargoTrack a payment service provider under CBK rules.

-- ── Shipments can now be operated by another organisation ──────────────────

-- carrier_org_id: the organisation that won the shipment on the marketplace.
-- fleet_org_id:   whose vehicles and drivers may be assigned: the shipper's
--                 own fleet until a carrier is awarded, then the carrier's.
ALTER TABLE shipments
    ADD COLUMN carrier_org_id uuid REFERENCES organizations (id),
    ADD COLUMN fleet_org_id   uuid;
UPDATE shipments SET fleet_org_id = org_id;
ALTER TABLE shipments
    ALTER COLUMN fleet_org_id SET NOT NULL,
    ADD CHECK (fleet_org_id = org_id OR fleet_org_id = carrier_org_id),
    DROP CONSTRAINT shipments_org_id_vehicle_id_fkey,
    DROP CONSTRAINT shipments_org_id_driver_id_fkey,
    ADD FOREIGN KEY (fleet_org_id, vehicle_id) REFERENCES vehicles (org_id, id),
    ADD FOREIGN KEY (fleet_org_id, driver_id)  REFERENCES drivers (org_id, id);
CREATE INDEX shipments_carrier_idx ON shipments (carrier_org_id) WHERE carrier_org_id IS NOT NULL;

-- The awarded carrier sees the shipment as well as its owner.
DROP POLICY tenant_isolation ON shipments;
CREATE POLICY tenant_isolation ON shipments
    USING (app_can_see(org_id) OR app_can_see(carrier_org_id))
    WITH CHECK (app_can_see(org_id) OR app_can_see(carrier_org_id));

-- Events are visible to whoever can see the shipment, whichever
-- organisation recorded them.
DROP POLICY tenant_isolation ON shipment_events;
CREATE POLICY tenant_isolation ON shipment_events
    USING (EXISTS (SELECT 1 FROM shipments s WHERE s.id = shipment_id))
    WITH CHECK (EXISTS (SELECT 1 FROM shipments s WHERE s.id = shipment_id));

-- ── Listings ────────────────────────────────────────────────────────────────

-- A snapshot of the shipment as carriers see it: no client reference, no
-- tracking number, and no shipper name until the award, so carriers
-- cannot take the job off the platform.
CREATE TABLE listings (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                 bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    org_id              uuid        NOT NULL REFERENCES organizations (id),
    shipment_id         uuid        NOT NULL REFERENCES shipments (id),
    origin_name         text        NOT NULL,
    origin_country      char(2)     NOT NULL,
    destination_name    text        NOT NULL,
    destination_country char(2)     NOT NULL,
    cargo_description   text        NOT NULL,
    weight_kg           numeric(10, 2) NOT NULL,
    pieces              integer     NOT NULL,
    pickup_at           timestamptz NOT NULL,
    deliver_by          timestamptz NOT NULL,
    notes               text        NOT NULL DEFAULT '',
    closes_at           timestamptz NOT NULL,
    status              text        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open', 'awarded', 'withdrawn')),
    awarded_bid_id      uuid,
    created_by          uuid        REFERENCES users (id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
-- At most one open listing per shipment; a retried listing request fails
-- here, before it is charged.
CREATE UNIQUE INDEX listings_one_open_idx ON listings (shipment_id) WHERE status = 'open';
CREATE INDEX listings_open_idx ON listings (seq DESC) WHERE status = 'open';

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings FORCE ROW LEVEL SECURITY;
-- Every signed-in organisation can browse open listings; only the owner
-- sees its closed ones and only the owner writes. An unscoped transaction
-- still sees nothing.
CREATE POLICY listings_read ON listings FOR SELECT USING (
    app_can_see(org_id)
    OR (status = 'open' AND coalesce(current_setting('app.org_id', true), '') <> ''));
CREATE POLICY listings_write ON listings FOR ALL
    USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));

-- ── Bids ────────────────────────────────────────────────────────────────────

-- Sealed: a bid is visible to the carrier that made it and to the
-- listing's owner, never to competing carriers.
CREATE TABLE bids (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      uuid        NOT NULL REFERENCES listings (id),
    carrier_org_id  uuid        NOT NULL REFERENCES organizations (id),
    -- Carrier's name as of bidding, so the shipper can see who bid without
    -- being able to read the carrier's organisation row.
    carrier_name    text        NOT NULL,
    price_cents     bigint      NOT NULL CHECK (price_cents > 0),
    note            text        NOT NULL DEFAULT '',
    status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    -- Set on acceptance, so the carrier can open the shipment it won once
    -- the listing is closed and no longer visible to it.
    shipment_id     uuid        REFERENCES shipments (id),
    created_by      uuid        REFERENCES users (id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bids_one_pending_idx ON bids (listing_id, carrier_org_id) WHERE status = 'pending';
CREATE INDEX bids_carrier_idx ON bids (carrier_org_id, created_at DESC);
ALTER TABLE listings ADD FOREIGN KEY (awarded_bid_id) REFERENCES bids (id);

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids FORCE ROW LEVEL SECURITY;
CREATE POLICY bids_read ON bids FOR SELECT USING (
    app_can_see(carrier_org_id)
    OR EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND app_can_see(l.org_id)));
CREATE POLICY bids_insert ON bids FOR INSERT WITH CHECK (app_can_see(carrier_org_id));
CREATE POLICY bids_update ON bids FOR UPDATE
    USING (app_can_see(carrier_org_id)
           OR EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND app_can_see(l.org_id)))
    WITH CHECK (app_can_see(carrier_org_id)
           OR EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND app_can_see(l.org_id)));

INSERT INTO meters (code, name, description, unit_price_cents) VALUES
    ('marketplace.listing', 'Marketplace listing',
     'Putting one shipment out to carriers for bids. Bidding is free for carriers.', 10000);
