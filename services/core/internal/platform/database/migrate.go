package database

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strconv"
	"strings"
)

// migrationLock is an arbitrary constant key for pg_advisory_xact_lock, so
// two replicas starting at once apply migrations one after the other.
const migrationLock = 7_330_001

// Migrate applies, in order, every NNNN_name.sql file in dir that has not
// been applied yet. Each file runs in its own transaction together with
// the row that records it, so a failed migration leaves no trace.
// Migrations only move forward; a mistake is fixed by a new migration.
func (db *DB) Migrate(ctx context.Context, migrations fs.FS) error {
	files, err := fs.Glob(migrations, "*.sql")
	if err != nil {
		return err
	}
	sort.Strings(files)

	if _, err := db.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    integer     PRIMARY KEY,
			name       text        NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	for _, file := range files {
		version, err := strconv.Atoi(strings.SplitN(file, "_", 2)[0])
		if err != nil {
			return fmt.Errorf("migration %q: name must start with a number", file)
		}
		body, err := fs.ReadFile(migrations, file)
		if err != nil {
			return err
		}

		tx, err := db.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, migrationLock); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		var applied bool
		if err := tx.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version,
		).Scan(&applied); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if applied {
			_ = tx.Rollback(ctx)
			continue
		}
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", file, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, version, file,
		); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("migration %s: commit: %w", file, err)
		}
		slog.Info("migration applied", "file", file)
	}
	return nil
}
