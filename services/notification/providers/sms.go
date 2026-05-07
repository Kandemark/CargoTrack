package providers

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// SMSProvider dispatches SMS via Africa's Talking or Twilio.
type SMSProvider struct {
	// Africa's Talking
	atUsername string
	atAPIKey   string
	// Twilio
	twilioAccountSID string
	twilioAuthToken  string
	twilioFromNumber string
	client           *http.Client
}

func NewSMSProvider(atUsername, atAPIKey, twilioSID, twilioToken, twilioFrom string) *SMSProvider {
	return &SMSProvider{
		atUsername:        atUsername,
		atAPIKey:          atAPIKey,
		twilioAccountSID:  twilioSID,
		twilioAuthToken:   twilioToken,
		twilioFromNumber:  twilioFrom,
		client:            &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *SMSProvider) Name() string { return "sms" }

func (p *SMSProvider) Send(ctx context.Context, msg *Message) error {
	// Prefer Africa's Talking for African numbers, fallback to Twilio
	if p.atAPIKey != "" {
		return p.sendViaAfricasTalking(ctx, msg)
	}
	if p.twilioAccountSID != "" {
		return p.sendViaTwilio(ctx, msg)
	}
	return fmt.Errorf("no SMS provider configured")
}

func (p *SMSProvider) sendViaAfricasTalking(ctx context.Context, msg *Message) error {
	data := url.Values{}
	data.Set("username", p.atUsername)
	data.Set("to", msg.Recipient)
	data.Set("message", fmt.Sprintf("%s: %s", msg.Title, msg.Body))

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.africastalking.com/version1/messaging",
		strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", p.atAPIKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("africa's talking send: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("africa's talking returned status %d", resp.StatusCode)
	}
	return nil
}

func (p *SMSProvider) sendViaTwilio(ctx context.Context, msg *Message) error {
	data := url.Values{}
	data.Set("To", msg.Recipient)
	data.Set("From", p.twilioFromNumber)
	data.Set("Body", fmt.Sprintf("%s: %s", msg.Title, msg.Body))

	twilioURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		p.twilioAccountSID)

	req, err := http.NewRequestWithContext(ctx, "POST", twilioURL, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(p.twilioAccountSID, p.twilioAuthToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("twilio send: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("twilio returned status %d", resp.StatusCode)
	}
	return nil
}
