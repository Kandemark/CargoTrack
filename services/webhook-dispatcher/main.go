package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/cargotrack/webhook-dispatcher/consumer"
	"github.com/cargotrack/webhook-dispatcher/dispatcher"
	"github.com/cargotrack/webhook-dispatcher/retry"
)

func main() {
	cfg := LoadConfig()

	if cfg.LogJSON {
		log.SetFlags(0)
	}
	log.SetOutput(os.Stdout)

	log.Println("[INFO] CargoTrack Webhook Dispatcher starting")
	log.Printf("[INFO] Kafka brokers: %s", cfg.KafkaBrokers)
	log.Printf("[INFO] Kafka topics: %v", cfg.KafkaTopics)

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
		log.Fatalf("[FATAL] %v", err)
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
