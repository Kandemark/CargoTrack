package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// WhatsAppProvider sends messages via Meta Business API.
type WhatsAppProvider struct {
	token   string
	phoneID string
	client  *http.Client
}

func NewWhatsAppProvider(token, phoneID string) *WhatsAppProvider {
	return &WhatsAppProvider{
		token:   token,
		phoneID: phoneID,
		client:  &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *WhatsAppProvider) Name() string { return "whatsapp" }

func (p *WhatsAppProvider) Send(ctx context.Context, msg *Message) error {
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                msg.Recipient,
		"type":              "text",
		"text": map[string]string{
			"body": fmt.Sprintf("*%s*\n\n%s", msg.Title, msg.Body),
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("whatsapp marshal: %w", err)
	}

	url := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/messages", p.phoneID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp send: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("whatsapp returned status %d", resp.StatusCode)
	}
	return nil
}
