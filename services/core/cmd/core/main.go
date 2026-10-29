// Command core is CargoTrack's business API: organisations, prepaid
// billing, payments, shipments, fleet, and the freight marketplace, with customs
// to follow as further modules of the same service.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cargotrack/core/internal/billing"
	"github.com/cargotrack/core/internal/fleet"
	"github.com/cargotrack/core/internal/marketplace"
	"github.com/cargotrack/core/internal/orgs"
	"github.com/cargotrack/core/internal/payments"
	"github.com/cargotrack/core/internal/payments/mpesa"
	"github.com/cargotrack/core/internal/platform/auth"
	"github.com/cargotrack/core/internal/platform/config"
	"github.com/cargotrack/core/internal/platform/database"
	"github.com/cargotrack/core/internal/platform/httpx"
	"github.com/cargotrack/core/internal/shipments"
	"github.com/cargotrack/core/migrations"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("core stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.Migrate(ctx, migrations.FS); err != nil {
		return err
	}

	var providers []payments.Provider
	if cfg.MPesa.Enabled() {
		base := mpesa.SandboxURL
		switch {
		case cfg.MPesa.Environment == "production":
			base = mpesa.ProductionURL
		case cfg.MPesa.BaseURL != "":
			base = cfg.MPesa.BaseURL
			slog.Warn("M-Pesa calls go to a non-Safaricom address", "base_url", base)
		}
		providers = append(providers, mpesa.New(mpesa.Config{
			BaseURL:        base,
			ConsumerKey:    cfg.MPesa.ConsumerKey,
			ConsumerSecret: cfg.MPesa.ConsumerSecret,
			Shortcode:      cfg.MPesa.Shortcode,
			Passkey:        cfg.MPesa.Passkey,
			CallbackURL:    cfg.MPesa.CallbackURL,
			CallbackToken:  cfg.MPesa.CallbackToken,
		}))
	} else {
		slog.Warn("no payment provider configured: customers cannot top up")
	}
	registry := payments.NewRegistry(providers...)

	orgService := orgs.NewService(db)
	billingService := billing.NewService(db, registry, billing.Options{
		MinTopUpCents:   cfg.MinTopUpCents,
		LowBalanceCents: cfg.LowBalanceCents,
		CheckInterval:   time.Duration(cfg.TopUpCheckInterval) * time.Second,
	})

	mux := http.NewServeMux()
	authn := auth.Middleware(auth.NewOIDCVerifier(cfg.OIDCIssuer, cfg.OIDCAudience), orgService)
	mux.Handle("GET /healthz", httpx.Handle(func(w http.ResponseWriter, r *http.Request) error {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return nil
	}))
	mux.Handle("GET /readyz", httpx.Handle(func(w http.ResponseWriter, r *http.Request) error {
		if err := db.Ping(r.Context()); err != nil {
			return httpx.NewError(http.StatusServiceUnavailable, "database_unavailable", "Database is unreachable.")
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
		return nil
	}))
	orgService.Routes(mux, authn)
	billingService.Routes(mux, authn)
	fleetService := fleet.NewService(db)
	fleetService.Routes(mux, authn)
	shipmentService := shipments.NewService(db, billingService, fleetService)
	shipmentService.Routes(mux, authn)
	marketplaceService := marketplace.NewService(db, billingService, shipmentService)
	shipmentService.SetListings(marketplaceService)
	marketplaceService.Routes(mux, authn)

	go billingService.Reconcile(ctx, time.Minute)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpx.Recover(httpx.CORS(cfg.CORSOrigins, mux)),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	errc := make(chan error, 1)
	go func() {
		slog.Info("core listening", "addr", cfg.HTTPAddr)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
