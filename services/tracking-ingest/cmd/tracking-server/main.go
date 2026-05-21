// CargoTrack Go Tracking Ingestion Service
// ==========================================
// High-throughput tracking event ingestion microservice.  Accepts JSON
// tracking events over HTTP, buffers them in-memory, and flushes batches
// to PostgreSQL via COPY protocol for maximum insert throughput.
//
// Build:  go build -o tracking-server .
// Run:    TRACKING_DB_URL=postgres://... TRACKING_PORT=8080 ./tracking-server
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Configuration ────────────────────────────────────────────────────────────

var (
	dbURL      = envOrDefault("TRACKING_DB_URL", "postgres://postgres:postgres@localhost:5432/cargotrack?sslmode=disable")
	listenPort = envOrDefault("TRACKING_PORT", "8080")
	jwtSecret  = os.Getenv("JWT_SECRET_KEY") // HS256 shared secret with Django
	batchSize  = 1000                        // flush after this many events
	flushEvery = 5 * time.Second             // or after this much time, whichever is first
	logger     *slog.Logger
)

// ── Domain types ─────────────────────────────────────────────────────────────

type TrackingEvent struct {
	ShipmentID int    `json:"shipment_id"`
	EventType  string `json:"event_type"`
	Location   string `json:"location"`
	Notes      string `json:"notes"`
	RecordedBy int    `json:"recorded_by"`
}

// ── Ingestor ─────────────────────────────────────────────────────────────────

type Ingestor struct {
	pool  *pgxpool.Pool
	mu    sync.Mutex
	buf   []TrackingEvent
	flush chan struct{}
}

func NewIngestor(pool *pgxpool.Pool) *Ingestor {
	ing := &Ingestor{
		pool:  pool,
		buf:   make([]TrackingEvent, 0, batchSize),
		flush: make(chan struct{}, 1),
	}
	go ing.flushLoop()
	return ing
}

// Add appends an event to the buffer.  Thread-safe.
func (ing *Ingestor) Add(ev TrackingEvent) {
	ing.mu.Lock()
	ing.buf = append(ing.buf, ev)
	shouldFlush := len(ing.buf) >= batchSize
	ing.mu.Unlock()

	if shouldFlush {
		select {
		case ing.flush <- struct{}{}:
		default:
		}
	}
}

// flushLoop periodically flushes the buffer to PostgreSQL.
func (ing *Ingestor) flushLoop() {
	ticker := time.NewTicker(flushEvery)
	defer ticker.Stop()

	for range ticker.C {
		select {
		case <-ing.flush:
			ing.flushBatch()
		default:
			ing.mu.Lock()
			n := len(ing.buf)
			ing.mu.Unlock()
			if n > 0 {
				ing.flushBatch()
			}
		}
	}
}

// flushBatch bulk-inserts buffered events using COPY protocol.
func (ing *Ingestor) flushBatch() {
	ing.mu.Lock()
	if len(ing.buf) == 0 {
		ing.mu.Unlock()
		return
	}
	batch := ing.buf
	ing.buf = make([]TrackingEvent, 0, batchSize)
	ing.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := ing.copyInsert(ctx, batch)
	if err != nil {
		logger.Warn("COPY insert failed, falling back to multi-row INSERT", "error", err)
		err = ing.rowInsert(ctx, batch)
		if err != nil {
			logger.Error("batch insert failed", "count", len(batch), "error", err)
			return
		}
	}

	logger.Info("flushed tracking events to PostgreSQL", "count", len(batch))
}

func (ing *Ingestor) copyInsert(ctx context.Context, batch []TrackingEvent) error {
	tx, err := ing.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.CopyFrom(
		ctx,
		pgx.Identifier{"tracking_trackingevent"},
		[]string{"shipment_id", "event_type", "location", "notes", "recorded_by_id", "timestamp"},
		pgx.CopyFromSlice(len(batch), func(i int) ([]any, error) {
			ev := batch[i]
			return []any{ev.ShipmentID, ev.EventType, ev.Location, ev.Notes, ev.RecordedBy, time.Now()}, nil
		}),
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (ing *Ingestor) rowInsert(ctx context.Context, batch []TrackingEvent) error {
	tx, err := ing.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for i := 0; i < len(batch); i += 100 {
		end := i + 100
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]
		rows := make([][]any, len(chunk))
		for j, ev := range chunk {
			rows[j] = []any{ev.ShipmentID, ev.EventType, ev.Location, ev.Notes, ev.RecordedBy, time.Now()}
		}
		_, err := tx.CopyFrom(
			ctx,
			pgx.Identifier{"tracking_trackingevent"},
			[]string{"shipment_id", "event_type", "location", "notes", "recorded_by_id", "timestamp"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ── HTTP handlers ────────────────────────────────────────────────────────────

func (ing *Ingestor) handleEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
		return
	}
	tokenString, ok := strings.CutPrefix(authHeader, "Bearer ")
	if !ok {
		http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
		return
	}
	if jwtSecret == "" {
		http.Error(w, `{"error":"server authentication not configured"}`, http.StatusInternalServerError)
		return
	}
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
		return
	}

	var ev TrackingEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	if ev.ShipmentID == 0 || ev.EventType == "" {
		http.Error(w, `{"error":"shipment_id and event_type are required"}`, http.StatusBadRequest)
		return
	}

	ing.Add(ev)
	w.WriteHeader(http.StatusAccepted)
	fmt.Fprintf(w, `{"status":"accepted"}`)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ing.mu.Lock()
	buffered := len(ing.buf)
	ing.mu.Unlock()
	fmt.Fprintf(w, `{"status":"healthy","buffered":%d}`, buffered)
}

var ing *Ingestor

func main() {
	jsonHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger = slog.New(jsonHandler)
	slog.SetDefault(logger)

	logger.Info("CargoTrack Go Tracking Service starting", "port", listenPort)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		logger.Error("failed to connect to PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Error("PostgreSQL ping failed", "error", err)
		os.Exit(1)
	}
	logger.Info("connected to PostgreSQL")

	ing = NewIngestor(pool)

	mux := http.NewServeMux()
	mux.HandleFunc("/events", ing.handleEvent)
	mux.HandleFunc("/health", healthHandler)

	srv := &http.Server{
		Addr:         ":" + listenPort,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.Info("listening", "port", listenPort)
	if err := srv.ListenAndServe(); err != nil {
		logger.Error("server error", "error", err)
		os.Exit(1)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
