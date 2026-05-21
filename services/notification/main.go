package main

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/cargotrack/notification/consumer"
	"github.com/cargotrack/notification/dispatcher"
	"github.com/cargotrack/notification/providers"
	"github.com/cargotrack/notification/ratelimit"
	"github.com/cargotrack/notification/ussd"
)

func main() {
	cfg := LoadConfig()

	var handler slog.Handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	if !cfg.LogJSON {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}
	logger := slog.New(handler)
	slog.SetDefault(logger)

	logger.Info("CargoTrack Notification Dispatch Service starting",
		"kafka_brokers", cfg.KafkaBrokers,
		"kafka_topics", cfg.KafkaTopics,
	)

	// Initialize providers — each is optional and configured via env vars.
	provs := make(map[string]providers.Provider)

	if cfg.FCMCredentialsPath != "" {
		provs["push"] = providers.NewFCMProvider(cfg.FCMCredentialsPath)
		logger.Info("FCM (push) provider configured")
	}
	if cfg.SMTPHost != "" {
		provs["email"] = providers.NewEmailProvider(
			cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom,
		)
		logger.Info("Email (SMTP) provider configured")
	}
	if cfg.ATAPIKey != "" || cfg.TwilioAccountSID != "" {
		provs["sms"] = providers.NewSMSProvider(
			cfg.ATUsername, cfg.ATAPIKey,
			cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber,
		)
		logger.Info("SMS provider configured")
	}
	if cfg.WhatsAppToken != "" {
		provs["whatsapp"] = providers.NewWhatsAppProvider(cfg.WhatsAppToken, cfg.WhatsAppPhoneID)
		logger.Info("WhatsApp provider configured")
	}

	if len(provs) == 0 {
		logger.Warn("no notification providers configured — service will be a no-op")
	}

	// ── Africa's Talking enhanced client (SMS bulk, USSD, Voice, Airtime) ──
	var atClient *providers.AfricaSTalkingClient
	if cfg.ATAPIKey != "" {
		atClient = providers.NewAfricaSTalkingClient(
			cfg.ATUsername, cfg.ATAPIKey, cfg.ATShortCode, cfg.ATSenderID,
		)
		logger.Info("Africa's Talking client created", "shortcode", cfg.ATShortCode)
	}

	// ── USSD server (driver self-service via *384# and similar shortcodes) ──
	if atClient != nil && cfg.USSDAddr != "" {
		ussdSrv := ussd.NewServer(atClient, cfg.USSDAddr)
		go func() {
			logger.Info("USSD gateway starting", "addr", cfg.USSDAddr)
			if err := ussdSrv.Start(); err != nil {
				logger.Error("USSD server error", "error", err)
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
