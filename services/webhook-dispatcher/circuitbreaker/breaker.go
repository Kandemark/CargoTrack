package circuitbreaker

import (
	"errors"
	"sync"
	"time"
)

// State represents the circuit breaker state.
type State int

const (
	StateClosed   State = iota
	StateOpen     State = iota
	StateHalfOpen State = iota
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker implements a per-endpoint circuit breaker pattern.
// When a downstream endpoint fails repeatedly, the circuit opens and
// requests are rejected immediately instead of waiting for timeouts.
type CircuitBreaker struct {
	mu            sync.Mutex
	state         State
	failureCount  int
	successCount  int
	lastFailure   time.Time
	failureThresh int
	successThresh int // successes needed in half-open to close
	openTimeout   time.Duration
}

func NewCircuitBreaker(failureThresh, successThresh int, openTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:         StateClosed,
		failureThresh: failureThresh,
		successThresh: successThresh,
		openTimeout:   openTimeout,
	}
}

// Allow returns true if a request may be attempted.
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		if time.Since(cb.lastFailure) > cb.openTimeout {
			cb.state = StateHalfOpen
			cb.successCount = 0
			return true
		}
		return false
	case StateHalfOpen:
		return true
	}
	return true
}

// RecordSuccess marks a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount = 0
	if cb.state == StateHalfOpen {
		cb.successCount++
		if cb.successCount >= cb.successThresh {
			cb.state = StateClosed
			cb.successCount = 0
		}
	}
}

// RecordFailure marks a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount++
	cb.lastFailure = time.Now()
	if cb.state == StateHalfOpen || cb.failureCount >= cb.failureThresh {
		cb.state = StateOpen
	}
}

var ErrCircuitOpen = errors.New("circuit breaker is open")
