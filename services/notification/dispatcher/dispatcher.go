package dispatcher

import (
	"context"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/cargotrack/notification/providers"
)

// Dispatcher routes notification events to the appropriate provider channels.
type Dispatcher struct {
	providers map[string]providers.Provider
	templates *TemplateEngine
	maxRetry  int
}

func NewDispatcher(provs map[string]providers.Provider, engine *TemplateEngine) *Dispatcher {
	return &Dispatcher{
		providers: provs,
		templates: engine,
		maxRetry:  5,
	}
}

// Dispatch sends a notification event to all configured channels with retry.
func (d *Dispatcher) Dispatch(ctx context.Context, evt *NotificationEvent) error {
	var lastErr error
	success := 0

	for _, channel := range evt.Channels {
		provider, ok := d.providers[channel]
		if !ok {
			log.Printf("[WARN] no provider configured for channel: %s", channel)
			continue
		}

		title, body, err := d.templates.Render(channel, evt)
		if err != nil {
			log.Printf("[ERROR] template render for %s: %v", channel, err)
			continue
		}

		msg := &providers.Message{
			Recipient:   resolveRecipient(channel, evt),
			Channel:     channel,
			Title:       title,
			Body:        body,
			Data:        evt.Metadata,
			ActionURL:   evt.ActionURL,
			TemplateRef: channel + "_default",
		}

		if err := d.sendWithRetry(ctx, provider, msg); err != nil {
			log.Printf("[ERROR] %s send to %s failed: %v", channel, evt.UserID, err)
			lastErr = err
		} else {
			success++
		}
	}

	if success == 0 && lastErr != nil {
		return fmt.Errorf("all channels failed for user %s: %w", evt.UserID, lastErr)
	}
	return nil
}

func (d *Dispatcher) sendWithRetry(ctx context.Context, p providers.Provider, msg *providers.Message) error {
	var err error
	for attempt := 0; attempt < d.maxRetry; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			if backoff > 60*time.Second {
				backoff = 60 * time.Second
			}
			log.Printf("[INFO] retry %d/%d for %s to %s (backoff %v)",
				attempt, d.maxRetry, p.Name(), msg.Recipient, backoff)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		err = p.Send(ctx, msg)
		if err == nil {
			return nil
		}
		log.Printf("[WARN] %s send attempt %d failed: %v", p.Name(), attempt+1, err)
	}

	return fmt.Errorf("exhausted %d retries: %w", d.maxRetry, err)
}

func resolveRecipient(channel string, evt *NotificationEvent) string {
	// Use the pre-resolved recipient from the event if present.
	if evt.Recipient != "" {
		return evt.Recipient
	}
	// Fallback to user_id — providers may need a lookup service to
	// resolve user_id → device token / phone / email.
	return evt.UserID
}
