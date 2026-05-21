package consumer

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/cargotrack/webhook-dispatcher/dispatcher"
)

// RegistrationStore abstracts where webhook registrations are persisted.
type RegistrationStore interface {
	GetByEvent(ctx context.Context, event string) ([]*dispatcher.WebhookRegistration, error)
}

// StaticRegistrationStore provides webhook registrations for dev/testing.
type StaticRegistrationStore struct {
	regs []*dispatcher.WebhookRegistration
}

func NewStaticRegistrationStore(regs []*dispatcher.WebhookRegistration) *StaticRegistrationStore {
	return &StaticRegistrationStore{regs: regs}
}

func (s *StaticRegistrationStore) GetByEvent(ctx context.Context, event string) ([]*dispatcher.WebhookRegistration, error) {
	var matched []*dispatcher.WebhookRegistration
	for _, r := range s.regs {
		for _, e := range r.Events {
			if e == event || e == "*" {
				matched = append(matched, r)
				break
			}
		}
	}
	return matched, nil
}

// KafkaWebhookConsumer reads events from Kafka and dispatches webhooks.
type KafkaWebhookConsumer struct {
	brokers []string
	group   string
	topics  []string
	store   RegistrationStore
	dispatch *dispatcher.Dispatcher
}

func NewKafkaWebhookConsumer(
	brokers []string,
	group string,
	topics []string,
	store RegistrationStore,
	dispatch *dispatcher.Dispatcher,
) *KafkaWebhookConsumer {
	return &KafkaWebhookConsumer{
		brokers:  brokers,
		group:    group,
		topics:   topics,
		store:    store,
		dispatch: dispatch,
	}
}

// Run starts consuming from Kafka topics. Blocks until SIGINT/SIGTERM.
func (c *KafkaWebhookConsumer) Run(ctx context.Context) error {
	slog.Info("Webhook consumer starting", "brokers", c.brokers, "group", c.group, "topics", c.topics)

	// In production: sarama consumer group with per-partition handlers.
	// For now: dev mode stub that signals readiness.

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	slog.Info("Webhook dispatcher ready (dev mode)")
	slog.Info("Waiting for events...")

	<-sigCh
	slog.Info("Shutting down webhook dispatcher")
	return nil
}

// ProcessEvent is the event processing entry point called from Kafka consumer
// handler or dev HTTP endpoint.
func ProcessEvent(store RegistrationStore, dispatch *dispatcher.Dispatcher, topic string, raw []byte) error {
	// Derive event type from topic name
	event := deriveEventType(topic)

	regs, err := store.GetByEvent(context.Background(), event)
	if err != nil {
		return err
	}
	if len(regs) == 0 {
		slog.Debug("no webhook registrations", "event", event)
		return nil
	}

	dispatch.Deliver(context.Background(), regs, event, raw)
	return nil
}

func deriveEventType(topic string) string {
	// Map Kafka topic → event type string
	// e.g., "cargotrack.shipments.state" → "shipment.state_changed"
	switch {
	case contains(topic, "shipments.state"):
		return "shipment.state_changed"
	case contains(topic, "tracking.events"):
		return "tracking.event_received"
	case contains(topic, "alerts.triggered"):
		return "alert.triggered"
	case contains(topic, "gps.positions"):
		return "gps.position_updated"
	default:
		return topic
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
