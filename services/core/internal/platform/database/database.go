// Package database owns the Postgres connection pool and the transaction
// helpers every module uses.
//
// Tenant isolation is enforced by Postgres row-level security, not by
// remembering to add "WHERE org_id = ?" to each query. Tenant tables carry
// a policy that only returns rows whose org_id matches the app.org_id
// setting of the current transaction. A transaction that sets neither
// app.org_id nor app.system sees no tenant rows at all, so a forgotten
// scope fails closed instead of leaking another company's data.
package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps the pool. Modules receive a *DB, never a bare pool, so that
// every query runs inside one of the scoped transaction helpers below.
type DB struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*DB, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{pool: pool}, nil
}

func (db *DB) Close() { db.pool.Close() }

func (db *DB) Ping(ctx context.Context) error { return db.pool.Ping(ctx) }

// InOrg runs fn in a transaction that can only see rows belonging to orgID.
func (db *DB) InOrg(ctx context.Context, orgID string, fn func(pgx.Tx) error) error {
	if orgID == "" {
		return errors.New("database: InOrg called without an organisation")
	}
	return db.inTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.org_id', $1, true)`, orgID); err != nil {
			return fmt.Errorf("scope transaction to org: %w", err)
		}
		return fn(tx)
	})
}

// AsSystem runs fn in a transaction that can see every tenant's rows.
//
// Only for work that has no tenant until it finds one: payment provider
// callbacks looked up by provider reference, first-login provisioning, and
// platform-owner administration. Request handlers acting for a user must
// use InOrg.
func (db *DB) AsSystem(ctx context.Context, fn func(pgx.Tx) error) error {
	return db.inTx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('app.system', 'on', true)`); err != nil {
			return fmt.Errorf("mark system transaction: %w", err)
		}
		return fn(tx)
	})
}

func (db *DB) inTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	// Rollback after a successful Commit is a no-op; this also covers panics.
	defer func() { _ = tx.Rollback(ctx) }()
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
