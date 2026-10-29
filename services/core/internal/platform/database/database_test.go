package database_test

import (
	"context"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5"

	"github.com/cargotrack/core/internal/platform/testkit"
	"github.com/cargotrack/core/migrations"
)

func TestRowLevelSecurityIsolatesOrganisations(t *testing.T) {
	db := testkit.DB(t)
	ctx := context.Background()

	var a, b string
	if err := db.AsSystem(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `INSERT INTO organizations (idp_org_id, name) VALUES ('za', 'A') RETURNING id`).Scan(&a); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `INSERT INTO organizations (idp_org_id, name) VALUES ('zb', 'B') RETURNING id`).Scan(&b)
	}); err != nil {
		t.Fatal(err)
	}

	countIn := func(org string) (n int) {
		t.Helper()
		if err := db.InOrg(ctx, org, func(tx pgx.Tx) error {
			// Deliberately no WHERE clause: the database must do the scoping.
			return tx.QueryRow(ctx, `SELECT count(*) FROM organizations`).Scan(&n)
		}); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if n := countIn(a); n != 1 {
		t.Fatalf("org A sees %d organisations, want 1", n)
	}

	var name string
	if err := db.InOrg(ctx, a, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT name FROM organizations`).Scan(&name)
	}); err != nil || name != "A" {
		t.Fatalf("org A read %q, %v; want its own row", name, err)
	}

	// Writing a row for another organisation is refused, not silently allowed.
	err := db.InOrg(ctx, a, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO users (idp_user_id, org_id) VALUES ('intruder', $1)`, b)
		return err
	})
	if err == nil {
		t.Fatal("org A inserted a user into org B")
	}
}

func TestUnscopedTransactionSeesNothing(t *testing.T) {
	db := testkit.DB(t)
	ctx := context.Background()
	if err := db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO organizations (idp_org_id, name) VALUES ('zc', 'C')`)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	// Reset both settings in a scoped transaction: the state a forgotten
	// scope would leave behind.
	var n int
	err := db.InOrg(ctx, "00000000-0000-0000-0000-000000000000", func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.org_id', '', true)`); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `SELECT count(*) FROM organizations`).Scan(&n)
	})
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("unscoped transaction saw %d organisations, want 0", n)
	}
}

func TestInOrgRequiresOrganisation(t *testing.T) {
	db := testkit.DB(t)
	if err := db.InOrg(context.Background(), "", func(pgx.Tx) error { return nil }); err == nil {
		t.Fatal("InOrg accepted an empty organisation")
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	db := testkit.DB(t)
	if err := db.Migrate(context.Background(), migrations.FS); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

// A data migration must see existing rows despite forced row-level security.
func TestMigrationsSeeTenantRows(t *testing.T) {
	db := testkit.DB(t)
	ctx := context.Background()
	if err := db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO organizations (idp_org_id, name) VALUES ('zm', 'lowercase name')`)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	migration := fstest.MapFS{"9001_upper_names.sql": {Data: []byte(`UPDATE organizations SET name = upper(name)`)}}
	if err := db.Migrate(ctx, migration); err != nil {
		t.Fatal(err)
	}
	var name string
	if err := db.AsSystem(ctx, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `SELECT name FROM organizations WHERE idp_org_id = 'zm'`).Scan(&name)
	}); err != nil {
		t.Fatal(err)
	}
	if name != "LOWERCASE NAME" {
		t.Fatalf("data migration did not reach existing rows: name = %q", name)
	}
}
