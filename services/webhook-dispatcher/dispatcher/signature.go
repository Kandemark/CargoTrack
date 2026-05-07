package dispatcher

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// Signer generates HMAC-SHA256 signatures for webhook payloads.
type Signer struct {
	secret []byte
}

func NewSigner(secret string) *Signer {
	return &Signer{secret: []byte(secret)}
}

// Sign generates a webhook signature header value.
// Format: t=timestamp,v1=hex(HMAC-SHA256(timestamp.body))
func (s *Signer) Sign(body []byte) (string, string) {
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	signature := hex.EncodeToString(mac.Sum(nil))
	return timestamp, fmt.Sprintf("t=%s,v1=%s", timestamp, signature)
}

// Verify checks an incoming webhook signature (for inbound webhooks if needed).
func (s *Signer) Verify(body []byte, headerValue string) bool {
	// Parse t=...,v1=... from header
	var timestamp, sig string
	if _, err := fmt.Sscanf(headerValue, "t=%s,v1=%s", &timestamp, &sig); err != nil {
		return false
	}

	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(expected))
}
