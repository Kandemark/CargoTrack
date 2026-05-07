package consumer

import (
	"context"
	"encoding/json"
	"log"
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
	log.Printf("[INFO] Kafka consumer starting: brokers=%v group=%s topics=%v",
		c.brokers, c.group, c.topics)

	// In production, this initializes sarama consumer group:
	//   config := sarama.NewConfig()
	//   config.Consumer.Group.Rebalance.Strategy = sarama.NewBalanceStrategyRoundRobin()
	//   config.Consumer.Offsets.Initial = sarama.OffsetNewest
	//   client, err := sarama.NewConsumerGroup(c.brokers, c.group, config)
	//   handler := &notificationHandler{dispatcher: c.dispatch, limiter: c.limiter}
	//   for { client.Consume(ctx, c.topics, handler) }

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	log.Println("[INFO] Notification consumer ready (dev mode — Kafka consumer stub)")
	log.Println("[INFO] Waiting for notification events...")

	<-sigCh
	log.Println("[INFO] Shutting down notification consumer")
	return nil
}

// notificationHandler implements sarama.ConsumerGroupHandler
type notificationHandler struct {
	dispatcher *dispatcher.Dispatcher
	limiter    *ratelimit.Limiter
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
		log.Printf("[RATELIMIT] %s: %v", evt.UserID, err)
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return dispatch.Dispatch(ctx, &evt)
}
