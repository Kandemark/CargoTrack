package consumer

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cargotrack/notification/dispatcher"
	"github.com/cargotrack/notification/ratelimit"
)

// KafkaConsumer reads notification events from Kafka and dispatches them.
// In production this uses Shopify/sarama or Confluent Kafka Go client.
// This implementation provides a stub for local development alongside the
// real consumer that will be wired when running in docker-compose with Kafka.
type KafkaConsumer struct {
	brokers  []string
	group    string
	topics   []string
	dispatch *dispatcher.Dispatcher
	limiter  *ratelimit.Limiter
}

func NewKafkaConsumer(
	brokers []string,
	group string,
	topics []string,
	dispatch *dispatcher.Dispatcher,
	limiter *ratelimit.Limiter,
) *KafkaConsumer {
	return &KafkaConsumer{
		brokers:  brokers,
		group:    group,
		topics:   topics,
		dispatch: dispatch,
		limiter:  limiter,
	}
}

// Run starts consuming from Kafka topics. It blocks until SIGINT/SIGTERM.
func (c *KafkaConsumer) Run(ctx context.Context) error {
	slog.Info("Kafka consumer starting", "brokers", c.brokers, "group", c.group, "topics", c.topics)

	// In production, this initializes sarama consumer group:
	//   config := sarama.NewConfig()
	//   config.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()
	//   config.Consumer.Offsets.Initial = sarama.OffsetNewest
	//   client, err := sarama.NewConsumerGroup(c.brokers, c.group, config)
	//   handler := &notificationHandler{dispatcher: c.dispatch, limiter: c.limiter}
	//   for { client.Consume(ctx, c.topics, handler) }

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	slog.Info("Notification consumer ready (dev mode — Kafka consumer stub)")
	slog.Info("Waiting for notification events...")

	<-sigCh
	slog.Info("Shutting down notification consumer")
	return nil
}

// ProcessEvent decodes a raw Kafka message and dispatches it.
// Called from the consumer group handler or dev HTTP endpoint.
func ProcessEvent(dispatch *dispatcher.Dispatcher, limiter *ratelimit.Limiter, raw []byte) error {
	var evt dispatcher.NotificationEvent
	if err := json.Unmarshal(raw, &evt); err != nil {
		return err
	}

	if evt.Timestamp.IsZero() {
		evt.Timestamp = time.Now()
	}

	if err := limiter.Allow(evt.UserID); err != nil {
		slog.Warn("rate limit exceeded", "user_id", evt.UserID, "error", err)
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return dispatch.Dispatch(ctx, &evt)
}
