package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// AfricaSTalkingClient is a full client for Africa's Talking APIs:
//   - SMS (bulk & premium)
//   - USSD (session-based menus)
//   - Voice (text-to-speech calls)
//   - Airtime (top-up for driver incentives)
//   - Delivery reports (callback)
type AfricaSTalkingClient struct {
	username      string
	apiKey        string
	shortCode     string // e.g. "38490" for USSD
	senderID      string // alphanumeric sender ID or shortcode for SMS
	client        *http.Client
	deliveryMu    sync.RWMutex
	deliveryCache map[string]*SMSDeliveryStatus // messageID -> status
}

// SMSDeliveryStatus tracks an SMS message through delivery lifecycle.
type SMSDeliveryStatus struct {
	MessageID  string    `json:"messageId"`
	Recipient  string    `json:"recipient"`
	Status     string    `json:"status"` // Queued, Sent, Delivered, Failed
	SentAt     time.Time `json:"sentAt"`
	DeliveredAt *time.Time `json:"deliveredAt,omitempty"`
	FailureReason string  `json:"failureReason,omitempty"`
	Retries    int       `json:"retries"`
}

// BulkSMSResponse is the Africa's Talking bulk SMS API response.
type BulkSMSResponse struct {
	SMSMessageData struct {
		Message    string              `json:"Message"`
		Recipients []SMSRecipientResult `json:"Recipients"`
	} `json:"SMSMessageData"`
}

// SMSRecipientResult is the per-recipient result from bulk SMS.
type SMSRecipientResult struct {
	StatusCode int    `json:"statusCode"`
	Number     string `json:"number"`
	MessageID  string `json:"messageId"`
	Cost       string `json:"cost"`
	Status     string `json:"status"`
}

// PremiumSMSRequest is for premium-rate SMS with keyword-based billing.
type PremiumSMSRequest struct {
	Recipients []string
	Message    string
	Keyword    string // e.g. "CARGO" for shortcode billing
	LinkID     string // transaction reference
}

// USSDRequest is an incoming USSD session request from Africa's Talking.
type USSDRequest struct {
	SessionID   string `json:"sessionId"`
	PhoneNumber string `json:"phoneNumber"`
	Text        string `json:"text"`       // user input, *-delimited for multi-step
	ServiceCode string `json:"serviceCode"` // the dialed shortcode
	NetworkCode string `json:"networkCode"` // e.g. 63902 (Safaricom)
}

// USSDResponse tells Africa's Talking what to display next.
type USSDResponse struct {
	SessionID   string `json:"sessionId"`
	Message     string `json:"message"`     // text to display to user
	ShouldClose bool   `json:"shouldClose"` // true = END, false = CON (continue)
	MenuLevel   int    `json:"-"`           // internal: tracks menu depth
}

// VoiceCallRequest initiates a text-to-speech call.
type VoiceCallRequest struct {
	Recipients []string `json:"recipients"`
	Message    string   `json:"message"`
	Repeat     int      `json:"repeat"` // times to repeat message
}

// VoiceCallResponse from Africa's Talking voice API.
type VoiceCallResponse struct {
	Entries []struct {
		PhoneNumber string `json:"phoneNumber"`
		Status      string `json:"status"`
		SessionID   string `json:"sessionId"`
	} `json:"entries"`
	ErrorMessage string `json:"errorMessage"`
}

// AirtimeRequest for topping up driver phones.
type AirtimeRequest struct {
	Recipients []AirtimeRecipient `json:"recipients"`
}

// AirtimeRecipient is an individual airtime top-up.
type AirtimeRecipient struct {
	PhoneNumber string `json:"phoneNumber"`
	Amount      string `json:"amount"` // e.g. "KES 100" or "UGX 5000"
	Currency    string `json:"currency"`
}

// NewAfricaSTalkingClient creates a new Africa's Talking client.
func NewAfricaSTalkingClient(username, apiKey, shortCode, senderID string) *AfricaSTalkingClient {
	return &AfricaSTalkingClient{
		username:      username,
		apiKey:        apiKey,
		shortCode:     shortCode,
		senderID:      senderID,
		client:        &http.Client{Timeout: 30 * time.Second},
		deliveryCache: make(map[string]*SMSDeliveryStatus),
	}
}

// ── SMS API ──────────────────────────────────────────────────────────────

// SendBulkSMS sends an SMS to multiple recipients and returns per-number results.
func (c *AfricaSTalkingClient) SendBulkSMS(ctx context.Context, recipients []string, message string) (*BulkSMSResponse, error) {
	data := url.Values{}
	data.Set("username", c.username)
	data.Set("to", strings.Join(recipients, ","))
	data.Set("message", message)
	if c.senderID != "" {
		data.Set("from", c.senderID)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.africastalking.com/version1/messaging",
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("africastalking bulk sms: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result BulkSMSResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("africastalking parse: %w (body: %s)", err, string(body))
	}

	// Track delivery status for each recipient
	now := time.Now()
	c.deliveryMu.Lock()
	for _, r := range result.SMSMessageData.Recipients {
		c.deliveryCache[r.MessageID] = &SMSDeliveryStatus{
			MessageID: r.MessageID,
			Recipient: r.Number,
			Status:    "Queued",
			SentAt:    now,
		}
	}
	c.deliveryMu.Unlock()

	return &result, nil
}

// SendPremiumSMS sends premium-rate SMS via a keyword on a shortcode.
func (c *AfricaSTalkingClient) SendPremiumSMS(ctx context.Context, req *PremiumSMSRequest) error {
	data := url.Values{}
	data.Set("username", c.username)
	data.Set("to", strings.Join(req.Recipients, ","))
	data.Set("message", req.Message)
	data.Set("keyword", req.Keyword)
	data.Set("linkId", req.LinkID)
	data.Set("from", c.shortCode)

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.africastalking.com/version1/messaging/premium",
		strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	httpReq.Header.Set("apikey", c.apiKey)
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("africastalking premium sms: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("premium sms failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// GetDeliveryStatus retrieves the delivery status of a previously sent SMS.
func (c *AfricaSTalkingClient) GetDeliveryStatus(messageID string) (*SMSDeliveryStatus, bool) {
	c.deliveryMu.RLock()
	defer c.deliveryMu.RUnlock()
	status, ok := c.deliveryCache[messageID]
	return status, ok
}

// HandleDeliveryReport processes an incoming delivery report callback from AT.
func (c *AfricaSTalkingClient) HandleDeliveryReport(report map[string]interface{}) {
	c.deliveryMu.Lock()
	defer c.deliveryMu.Unlock()

	id, _ := report["id"].(string)
	status, _ := report["status"].(string)

	if entry, ok := c.deliveryCache[id]; ok {
		entry.Status = status
		if status == "Delivered" || status == "Failed" {
			now := time.Now()
			entry.DeliveredAt = &now
		}
		if status == "Failed" {
			if reason, ok := report["failureReason"].(string); ok {
				entry.FailureReason = reason
			}
		}
	}
}

// ── USSD API ─────────────────────────────────────────────────────────────

// USSDCallbackHandler is the type for USSD menu callbacks.
// Called for each USSD session interaction. Returns the response and whether to close.
type USSDCallbackHandler func(session *USSDSession) (*USSDResponse, error)

// USSDSession tracks a single USSD session for a user.
type USSDSession struct {
	SessionID   string
	PhoneNumber string
	ServiceCode string
	NetworkCode string
	CurrentMenu string            // which menu node the user is on
	Inputs      []string          // user inputs collected so far
	Data        map[string]string // arbitrary session data
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// HandleUSSD processes an incoming USSD request through the menu tree.
func (c *AfricaSTalkingClient) HandleUSSD(req *USSDRequest, menus *USSDMenuTree, sessions *USSDSessionStore) *USSDResponse {
	// Parse user input path: "" means new session, each * is a level
	inputs := strings.Split(req.Text, "*")
	if req.Text == "" {
		inputs = nil
	}

	// Get or create session
	session := sessions.GetOrCreate(req.SessionID, req.PhoneNumber, req.ServiceCode, req.NetworkCode)
	session.Inputs = inputs
	session.UpdatedAt = time.Now()

	// Navigate menu tree
	current := menus.Root
	for i, input := range inputs {
		next, ok := current.Children[input]
		if !ok {
			// Invalid input — redisplay current menu
			return &USSDResponse{
				SessionID:   req.SessionID,
				Message:     "CON Invalid choice.\n" + current.Display(),
				ShouldClose: false,
			}
		}
		current = next
		_ = i // level tracking
	}

	// Execute action if leaf node
	if current.Action != nil {
		result, err := current.Action(session)
		if err != nil {
			return &USSDResponse{
				SessionID:   req.SessionID,
				Message:     "END An error occurred. Please try again later.",
				ShouldClose: true,
			}
		}
		return result
	}

	// If no children, terminate session
	if len(current.Children) == 0 {
		sessions.Remove(req.SessionID)
		return &USSDResponse{
			SessionID:   req.SessionID,
			Message:     "END " + current.Title,
			ShouldClose: true,
		}
	}

	// Display menu with options
	session.CurrentMenu = current.ID
	return &USSDResponse{
		SessionID:   req.SessionID,
		Message:     "CON " + current.Display(),
		ShouldClose: false,
	}
}

// ── Voice API ─────────────────────────────────────────────────────────────

// MakeVoiceCall initiates a text-to-speech call to one or more recipients.
// Useful for critical alerts: border closure, shipment emergency, etc.
func (c *AfricaSTalkingClient) MakeVoiceCall(ctx context.Context, recipients []string, message string, repeat int) (*VoiceCallResponse, error) {
	payload := map[string]interface{}{
		"username":  c.username,
		"to":        strings.Join(recipients, ","),
		"message":   message,
		"repeat":    repeat,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://voice.africastalking.com/call",
		strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("africastalking voice call: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result VoiceCallResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("voice call parse: %w", err)
	}
	return &result, nil
}

// ── Airtime API ───────────────────────────────────────────────────────────

// SendAirtime tops up driver phones — useful for incentives.
func (c *AfricaSTalkingClient) SendAirtime(ctx context.Context, recipients []AirtimeRecipient) error {
	payload := map[string]interface{}{
		"username":   c.username,
		"recipients": recipients,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.africastalking.com/version1/airtime/send",
		strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("africastalking airtime: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("airtime failed (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}
