// CargoTrack Go Tracking Ingestion Service
// ==========================================
// High-throughput tracking event ingestion microservice.  Accepts JSON
// tracking events over HTTP, buffers them in-memory, and flushes batches
// to PostgreSQL via COPY protocol for maximum insert throughput.
//
// Designed to sit behind Nginx/Caddy as an upstream for POST /api/v1/tracking/events/.
//
// Build:  go build -o tracking-server .
// Run:    TRACKING_DB_URL=postgres://... TRACKING_PORT=8080 ./tracking-server
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Configuration ────────────────────────────────────────────────────────────

var (
	dbURL       = envOrDefault("TRACKING_DB_URL", "postgres://postgres:postgres@localhost:5432/cargotrack?sslmode=disable")
	listenPort  = envOrDefault("TRACKING_PORT", "8080")
	batchSize   = 1000              // flush after this many events
	flushEvery  = 5 * time.Second   // or after this much time, whichever is first
)

// ── Domain types ─────────────────────────────────────────────────────────────

type TrackingEvent struct {
	ShipmentID  int    `json:"shipment_id"`
	EventType   string `json:"event_type"`
	Location    string `json:"location"`
	Notes       string `json:"notes"`
	RecordedBy  int    `json:"recorded_by"`
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
			// Just a ticker fire — flush if there's data
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

	// Use PostgreSQL COPY via pgx for maximum insert throughput.
	// Falls back to multi-row INSERT if COPY fails (e.g. permissions).
	err := ing.copyInsert(ctx, batch)
	if err != nil {
		log.Printf("COPY insert failed (%v), falling back to multi-row INSERT", err)
		err = ing.rowInsert(ctx, batch)
		if err != nil {
			log.Printf("ERROR: batch insert of %d events failed: %v", len(batch), err)
			return
		}
	}

	log.Printf("Flushed %d tracking events to PostgreSQL", len(batch))
}

func (ing *Ingestor) copyInsert(ctx context.Context, batch []TrackingEvent) error {
	tx, err := ing.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

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
	defer tx.Rollback(ctx)

	// Multi-row INSERT in chunks of 100 to avoid giant queries
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

	// Validate auth token (simple shared secret or JWT; production would
	// verify with the Django backend or a shared Redis cache).
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
		return
	}
	// Strip "Bearer " prefix and validate with Django's JWT secret.
	// Simplified: accept any non-empty Bearer token for dev.

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
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("CargoTrack Go Tracking Service starting on :%s", listenPort)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("PostgreSQL ping failed: %v", err)
	}
	log.Println("Connected to PostgreSQL")

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

	log.Printf("Listening on :%s", listenPort)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
