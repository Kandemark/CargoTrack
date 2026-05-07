package dispatcher

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/cargotrack/webhook-dispatcher/circuitbreaker"
	"github.com/cargotrack/webhook-dispatcher/retry"
)

// WebhookRegistration represents a tenant's webhook subscription.
type WebhookRegistration struct {
	ID        string   `json:"id"`
	TenantID  string   `json:"tenant_id"`
	URL       string   `json:"url"`
	Events    []string `json:"events"`     // event types this webhook receives
	Active    bool     `json:"active"`
	Secret    string   `json:"secret"`     // per-webhook HMAC secret override
	CreatedAt time.Time `json:"created_at"`
}

// WebhookPayload is the envelope sent to external endpoints.
type WebhookPayload struct {
	Event     string          `json:"event"`
	TenantID  string          `json:"tenant_id"`
	Timestamp time.Time       `json:"timestamp"`
	Data      json.RawMessage `json:"data"`
}

// Dispatcher delivers webhook events to registered endpoints.
type Dispatcher struct {
	client    *http.Client
	signer    *Signer
	breakers  map[string]*circuitbreaker.CircuitBreaker
	mu        sync.RWMutex
	backoff   *retry.Backoffer
}

func NewDispatcher(signer *Signer, backoff *retry.Backoffer) *Dispatcher {
	return &Dispatcher{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		signer:   signer,
		breakers: make(map[string]*circuitbreaker.CircuitBreaker),
		backoff:  backoff,
	}
}

// Deliver sends a webhook event to all registered endpoints matching the event type.
func (d *Dispatcher) Deliver(ctx context.Context, regs []*WebhookRegistration, event string, data json.RawMessage) {
	var wg sync.WaitGroup
	for _, reg := range regs {
		if !reg.Active {
			continue
		}
		if !matchesEvent(reg.Events, event) {
			continue
		}
		wg.Add(1)
		go func(r *WebhookRegistration) {
			defer wg.Done()
			d.deliverOne(ctx, r, event, data)
		}(reg)
	}
	wg.Wait()
}

func (d *Dispatcher) deliverOne(ctx context.Context, reg *WebhookRegistration, event string, data json.RawMessage) {
	breaker := d.getBreaker(reg.URL)
	if !breaker.Allow() {
		log.Printf("[CIRCUIT-OPEN] %s for %s", reg.URL, event)
		return
	}

	payload := WebhookPayload{
		Event:     event,
		TenantID:  reg.TenantID,
		Timestamp: time.Now().UTC(),
		Data:      data,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[ERROR] marshal webhook payload: %v", err)
		return
	}

	// Use per-webhook secret if set, otherwise global signing key
	signer := d.signer
	if reg.Secret != "" {
		signer = NewSigner(reg.Secret)
	}
	_, sigHeader := signer.Sign(body)

	err = d.backoff.Do(ctx, func() error {
		req, err := http.NewRequestWithContext(ctx, "POST", reg.URL, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CargoTrack-Signature", sigHeader)
		req.Header.Set("X-CargoTrack-Event", event)
		req.Header.Set("X-CargoTrack-Delivery-ID", fmt.Sprintf("%s_%d", reg.ID, time.Now().UnixNano()))

		resp, err := d.client.Do(req)
		if err != nil {
			breaker.RecordFailure()
			return fmt.Errorf("http post to %s: %w", reg.URL, err)
		}
		resp.Body.Close()

		if resp.StatusCode >= 500 {
			breaker.RecordFailure()
			return fmt.Errorf("server error %d from %s", resp.StatusCode, reg.URL)
		}
		if resp.StatusCode >= 400 {
			// Client errors don't trip the circuit breaker — they won't succeed on retry
			log.Printf("[WEBHOOK-CLIENT-ERROR] %s returned %d", reg.URL, resp.StatusCode)
			return nil
		}

		breaker.RecordSuccess()
		return nil
	})

	if err != nil {
		log.Printf("[WEBHOOK-FAILED] %s for event %s: %v", reg.URL, event, err)
	}
}

func (d *Dispatcher) getBreaker(url string) *circuitbreaker.CircuitBreaker {
	d.mu.RLock()
	cb, ok := d.breakers[url]
	d.mu.RUnlock()
	if ok {
		return cb
	}

	d.mu.Lock()
	defer d.mu.Unlock()
	// Double-check after acquiring write lock
	if cb, ok := d.breakers[url]; ok {
		return cb
	}
	cb = circuitbreaker.NewCircuitBreaker(5, 2, 30*time.Second)
	d.breakers[url] = cb
	return cb
}

func matchesEvent(subscribed []string, event string) bool {
	for _, e := range subscribed {
		if e == event || e == "*" {
			return true
		}
	}
	return false
}
