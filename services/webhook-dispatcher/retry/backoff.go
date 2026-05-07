package retry

import (
	"context"
	"log"
	"math"
	"time"
)

// Backoffer defines the retry schedule for failed webhook deliveries.
type Backoffer struct {
	MaxRetries int
	Schedule   []time.Duration // custom schedule or nil for exponential
}

// DefaultBackoff returns the standard exponential backoff schedule.
// 1m, 5m, 15m, 1h, 6h, 24h → dead-letter queue
func DefaultBackoff(maxRetries int) *Backoffer {
	return &Backoffer{
		MaxRetries: maxRetries,
		Schedule:   nil, // use exponential
	}
}

// CustomBackoffSchedule returns a backoffer with a fixed schedule.
func CustomBackoffSchedule(schedule []time.Duration) *Backoffer {
	return &Backoffer{
		MaxRetries: len(schedule),
		Schedule:   schedule,
	}
}

// Delay returns the delay for the given attempt (0-indexed).
func (b *Backoffer) Delay(attempt int) time.Duration {
	if b.Schedule != nil && attempt < len(b.Schedule) {
		return b.Schedule[attempt]
	}
	// Exponential: 2^attempt * 30s, capped at 24h
	delay := time.Duration(math.Pow(2, float64(attempt))) * 30 * time.Second
	maxDelay := 24 * time.Hour
	if delay > maxDelay {
		delay = maxDelay
	}
	return delay
}

// Do executes fn with retries and exponential backoff.
// Returns the last error if all attempts fail.
func (b *Backoffer) Do(ctx context.Context, fn func() error) error {
	var lastErr error
	for attempt := 0; attempt < b.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := b.Delay(attempt)
			log.Printf("[RETRY] attempt %d/%d after %v", attempt+1, b.MaxRetries, delay)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		if err := fn(); err != nil {
			lastErr = err
			continue
		}
		return nil
	}
	return lastErr
}
