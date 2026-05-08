package main

import (
	"context"
	"log"
	"os"

	"github.com/cargotrack/notification/consumer"
	"github.com/cargotrack/notification/dispatcher"
	"github.com/cargotrack/notification/providers"
	"github.com/cargotrack/notification/ratelimit"
	"github.com/cargotrack/notification/ussd"
)

func main() {
	cfg := LoadConfig()

	if cfg.LogJSON {
		log.SetFlags(0) // JSON logger handles its own formatting
	}
	log.SetOutput(os.Stdout)

	log.Printf("[INFO] CargoTrack Notification Dispatch Service starting")
	log.Printf("[INFO] Kafka brokers: %s", cfg.KafkaBrokers)
	log.Printf("[INFO] Kafka topics: %v", cfg.KafkaTopics)

	// Initialize providers — each is optional and configured via env vars.
	provs := make(map[string]providers.Provider)

	if cfg.FCMCredentialsPath != "" {
		provs["push"] = providers.NewFCMProvider(cfg.FCMCredentialsPath)
		log.Println("[INFO] FCM (push) provider configured")
	}
	if cfg.SMTPHost != "" {
		provs["email"] = providers.NewEmailProvider(
			cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom,
		)
		log.Println("[INFO] Email (SMTP) provider configured")
	}
	if cfg.ATAPIKey != "" || cfg.TwilioAccountSID != "" {
		provs["sms"] = providers.NewSMSProvider(
			cfg.ATUsername, cfg.ATAPIKey,
			cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber,
		)
		log.Println("[INFO] SMS provider configured")
	}
	if cfg.WhatsAppToken != "" {
		provs["whatsapp"] = providers.NewWhatsAppProvider(cfg.WhatsAppToken, cfg.WhatsAppPhoneID)
		log.Println("[INFO] WhatsApp provider configured")
	}

	if len(provs) == 0 {
		log.Println("[WARN] No notification providers configured — service will be a no-op")
	}

	// ── Africa's Talking enhanced client (SMS bulk, USSD, Voice, Airtime) ──
	var atClient *providers.AfricaSTalkingClient
	if cfg.ATAPIKey != "" {
		atClient = providers.NewAfricaSTalkingClient(
			cfg.ATUsername, cfg.ATAPIKey, cfg.ATShortCode, cfg.ATSenderID,
		)
		log.Printf("[INFO] Africa's Talking client created (shortcode: %s)", cfg.ATShortCode)
	}

	// ── USSD server (driver self-service via *384# and similar shortcodes) ──
	if atClient != nil && cfg.USSDAddr != "" {
		ussdSrv := ussd.NewServer(atClient, cfg.USSDAddr)
		go func() {
			log.Printf("[INFO] USSD gateway starting on %s", cfg.USSDAddr)
			if err := ussdSrv.Start(); err != nil {
				log.Printf("[ERROR] USSD server: %v", err)
			}
		}()
	}

	// Template engine
	engine := dispatcher.NewTemplateEngine()

	// Dispatcher with retry
	dispatch := dispatcher.NewDispatcher(provs, engine)

	// Rate limiter (in-memory for dev; Redis-backed in production)
	limiter := ratelimit.NewLimiter(10, 100) // 10/min, 100/hr per user

	// Kafka consumer
	kafkaConsumer := consumer.NewKafkaConsumer(
		splitBrokers(cfg.KafkaBrokers),
		cfg.KafkaConsumerGroup,
		cfg.KafkaTopics,
		dispatch,
		limiter,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := kafkaConsumer.Run(ctx); err != nil {
		log.Fatalf("[FATAL] %v", err)
	}
}

func splitBrokers(s string) []string {
	var result []string
	for _, b := range split(s, ',') {
		if t := trim(b); t != "" {
			result = append(result, t)
		}
	}
	return result
}

func split(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

func trim(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
