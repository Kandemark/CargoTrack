package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/cargotrack/webhook-dispatcher/consumer"
	"github.com/cargotrack/webhook-dispatcher/dispatcher"
	"github.com/cargotrack/webhook-dispatcher/retry"
)

func main() {
	cfg := LoadConfig()

	var handler slog.Handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	if !cfg.LogJSON {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("CargoTrack Webhook Dispatcher starting",
		"kafka_brokers", cfg.KafkaBrokers,
		"kafka_topics", cfg.KafkaTopics,
	)

	// HMAC-SHA256 signer
	signer := dispatcher.NewSigner(cfg.WebhookSecretKey)

	// Retry backoff: 1m, 5m, 15m, 1h, 6h, 24h
	backoff := retry.CustomBackoffSchedule([]time.Duration{
		1 * time.Minute,
		5 * time.Minute,
		15 * time.Minute,
		1 * time.Hour,
		6 * time.Hour,
		24 * time.Hour,
	})

	// Dispatcher with circuit breaker per endpoint
	dispatch := dispatcher.NewDispatcher(signer, backoff)

	// Registration store (dev: static; production: Redis-cached with Django API fallback)
	store := consumer.NewStaticRegistrationStore(nil)

	// Kafka consumer
	kafkaConsumer := consumer.NewKafkaWebhookConsumer(
		splitBrokers(cfg.KafkaBrokers),
		cfg.KafkaConsumerGroup,
		cfg.KafkaTopics,
		store,
		dispatch,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := kafkaConsumer.Run(ctx); err != nil {
		logger.Error("kafka consumer fatal error", "error", err)
		os.Exit(1)
	}
}

func splitBrokers(s string) []string {
	var result []string
	for _, b := range strings.Split(s, ",") {
		if t := strings.TrimSpace(b); t != "" {
			result = append(result, t)
		}
	}
	return result
}
