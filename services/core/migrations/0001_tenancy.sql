-- Organisations and users, and the row-level security rule every tenant
-- table shares.
--
-- Identity lives in Zitadel. These tables mirror the Zitadel organisation
-- and user the first time a token for them is seen, so that the rest of
-- the schema can reference them with real foreign keys.

-- True when the current transaction may see rows belonging to org.
-- Set by database.InOrg (app.org_id) and database.AsSystem (app.system).
-- With neither set, nothing is visible: a missing scope fails closed.
CREATE FUNCTION app_can_see(org uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT coalesce(current_setting('app.system', true), '') = 'on'
        OR org = nullif(current_setting('app.org_id', true), '')::uuid
$$;

CREATE TABLE organizations (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    idp_org_id  text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    country     char(2)     NOT NULL DEFAULT 'KE',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    idp_user_id  text        NOT NULL UNIQUE,
    org_id       uuid        NOT NULL REFERENCES organizations (id),
    email        text        NOT NULL DEFAULT '',
    display_name text        NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_org_id_idx ON users (org_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations USING (app_can_see(id)) WITH CHECK (app_can_see(id));

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users USING (app_can_see(org_id)) WITH CHECK (app_can_see(org_id));
