package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type FCMProvider struct {
	credentialPath string
	client         *http.Client
}

func NewFCMProvider(credentialPath string) *FCMProvider {
	return &FCMProvider{
		credentialPath: credentialPath,
		client:         &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *FCMProvider) Name() string { return "fcm" }

func (p *FCMProvider) Send(ctx context.Context, msg *Message) error {
	payload := map[string]interface{}{
		"message": map[string]interface{}{
			"token": msg.Recipient,
			"notification": map[string]string{
				"title": msg.Title,
				"body":  msg.Body,
			},
			"data": msg.Data,
			"webpush": map[string]interface{}{
				"fcm_options": map[string]string{
					"link": msg.ActionURL,
				},
			},
		},
	}

	body, _ := json.Marshal(payload)
	// In production this would use the Firebase Admin SDK or OAuth2 token
	// from the service account credentials at p.credentialPath.
	_ = body

	return fmt.Errorf("FCM provider requires Firebase Admin SDK — stub implementation")
}
