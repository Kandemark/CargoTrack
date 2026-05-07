package providers

import "context"

// Message is a unified notification payload after template rendering.
type Message struct {
	Recipient   string            // phone number, email, device token, etc.
	Channel     string            // push, sms, email, whatsapp
	Title       string            // notification title
	Body        string            // rendered body
	Data        map[string]string // key-value payload for routing/actions
	ActionURL   string            // deep link URL
	TemplateRef string            // which template was used (for logging)
}

// Provider is the interface each notification channel implements.
type Provider interface {
	Name() string
	Send(ctx context.Context, msg *Message) error
}
