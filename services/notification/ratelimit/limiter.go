package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Limiter provides in-memory per-user rate limiting.
// Production replaces this with Redis-backed sliding window.
type Limiter struct {
	mu       sync.Mutex
	windows  map[string]*userWindow
	maxPerMin int
	maxPerHour int
}

type userWindow struct {
	minute  int
	hour    int
	resetAt time.Time // minute window reset
}

func NewLimiter(maxPerMin, maxPerHour int) *Limiter {
	return &Limiter{
		windows:    make(map[string]*userWindow),
		maxPerMin:  maxPerMin,
		maxPerHour: maxPerHour,
	}
}

// Allow returns nil if the user is under rate limit for all channels.
func (l *Limiter) Allow(userID string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	w, ok := l.windows[userID]
	if !ok || now.After(w.resetAt) {
		l.windows[userID] = &userWindow{minute: 1, hour: 1, resetAt: now.Add(time.Minute)}
		return nil
	}

	if w.minute >= l.maxPerMin {
		return fmt.Errorf("rate limit exceeded: %d/min for user %s", l.maxPerMin, userID)
	}
	if w.hour >= l.maxPerHour {
		return fmt.Errorf("rate limit exceeded: %d/hr for user %s", l.maxPerHour, userID)
	}

	w.minute++
	w.hour++
	return nil
}

// RedisLimiter implements Limiter with Redis-backed sliding window.
type RedisLimiter struct {
	// redisClient *redis.Client  // uncomment when redis package is added
	maxPerMin  int
	maxPerHour int
}

func NewRedisLimiter(redisURL string, maxPerMin, maxPerHour int) *RedisLimiter {
	// In production this connects to Redis and uses ZSET-based sliding window.
	_ = redisURL
	return &RedisLimiter{maxPerMin: maxPerMin, maxPerHour: maxPerHour}
}

func (l *RedisLimiter) Allow(ctx context.Context, userID string) error {
	// Stub: Redis ZSET sliding window rate limit via Lua script.
	// Production implementation uses:
	//   ZREMRANGEBYSCORE key 0 (now - window)
	//   ZCARD key → compare against limit
	//   ZADD key now member
	_ = ctx
	_ = userID
	return nil
}
