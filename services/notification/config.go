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
	SMTPHost           string
	SMTPPort           int
	SMTPUser           string
	SMTPPassword       string
	SMTPFrom           string
	FCMCredentialsPath string
	APNSKeyPath        string
	APNSKeyID          string
	APNSTeamID         string
	TwilioAccountSID   string
	TwilioAuthToken    string
	TwilioFromNumber   string
	ATUsername         string // Africa's Talking
	ATAPIKey           string
	WhatsAppToken      string
	WhatsAppPhoneID    string
	LogJSON            bool
}

func LoadConfig() *Config {
	return &Config{
		KafkaBrokers:       envOr("KAFKA_BROKERS", "localhost:9092"),
		KafkaConsumerGroup: envOr("KAFKA_CONSUMER_GROUP", "cargotrack-notification"),
		KafkaTopics:        strings.Split(envOr("KAFKA_TOPICS", "cargotrack.alerts.triggered,cargotrack.notifications"), ","),
		RedisURL:           envOr("REDIS_URL", "redis://localhost:6379/0"),
		SMTPHost:           envOr("SMTP_HOST", "localhost"),
		SMTPPort:           envInt("SMTP_PORT", 587),
		SMTPUser:           os.Getenv("SMTP_USER"),
		SMTPPassword:       os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:           envOr("SMTP_FROM", "notifications@cargotrack.io"),
		FCMCredentialsPath: os.Getenv("FCM_CREDENTIALS_PATH"),
		APNSKeyPath:        os.Getenv("APNS_KEY_PATH"),
		APNSKeyID:          os.Getenv("APNS_KEY_ID"),
		APNSTeamID:         os.Getenv("APNS_TEAM_ID"),
		TwilioAccountSID:   os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:    os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber:   os.Getenv("TWILIO_FROM_NUMBER"),
		ATUsername:         os.Getenv("AFRICAS_TALKING_USERNAME"),
		ATAPIKey:           os.Getenv("AFRICAS_TALKING_API_KEY"),
		WhatsAppToken:      os.Getenv("WHATSAPP_TOKEN"),
		WhatsAppPhoneID:    os.Getenv("WHATSAPP_PHONE_ID"),
		LogJSON:            os.Getenv("LOG_JSON") == "1" || os.Getenv("LOG_JSON") == "true",
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
