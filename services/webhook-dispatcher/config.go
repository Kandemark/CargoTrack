package main

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	KafkaBrokers       string
	KafkaConsumerGroup string
	KafkaTopics        []string
	RedisURL           string
	WebhookSecretKey   string // HMAC-SHA256 signing key
	MaxRetries         int
	DeadLetterTopic    string
	LogJSON            bool
}

func LoadConfig() *Config {
	return &Config{
		KafkaBrokers:       envOr("KAFKA_BROKERS", "localhost:9092"),
		KafkaConsumerGroup: envOr("KAFKA_CONSUMER_GROUP", "cargotrack-webhook-dispatcher"),
		KafkaTopics:        strings.Split(envOr("KAFKA_TOPICS", "cargotrack.shipments.state,cargotrack.tracking.events,cargotrack.alerts.triggered"), ","),
		RedisURL:           envOr("REDIS_URL", "redis://localhost:6379/0"),
		WebhookSecretKey:   envOr("WEBHOOK_SECRET_KEY", "change-me-in-production"),
		MaxRetries:         envInt("MAX_RETRIES", 6),
		DeadLetterTopic:    envOr("DEAD_LETTER_TOPIC", "cargotrack.webhooks.dlq"),
		LogJSON:            os.Getenv("LOG_JSON") == "1",
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
