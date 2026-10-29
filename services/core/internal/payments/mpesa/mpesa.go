// Package mpesa implements payments.Provider for Safaricom M-Pesa through
// the Daraja API: Lipa Na M-Pesa Online (STK Push) to start a payment and
// STK Push Query to confirm it.
//
// Daraja callbacks carry no signature. They are authenticated only by a
// secret token in the callback URL, and even then they only trigger a
// Query: credit is released on what Daraja answers to our own
// authenticated request, never on what a callback says.
package mpesa

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/cargotrack/core/internal/payments"
)

const (
	SandboxURL    = "https://sandbox.safaricom.co.ke"
	ProductionURL = "https://api.safaricom.co.ke"

	// Daraja field limits.
	maxAccountReference = 12
	transactionDesc     = "CargoTrack"

	// Query answers with this error code while the customer has not yet
	// responded to the PIN prompt.
	stillProcessing = "500.001.1001"
)

// eat is East Africa Time. Daraja timestamps must be in Kenyan local time;
// a fixed zone avoids depending on the host's tzdata.
var eat = time.FixedZone("EAT", 3*60*60)

type Config struct {
	BaseURL        string
	ConsumerKey    string
	ConsumerSecret string
	Shortcode      string
	Passkey        string
	CallbackURL    string
	CallbackToken  string
}

type Provider struct {
	cfg    Config
	client *http.Client
	now    func() time.Time

	mu          sync.Mutex
	token       string
	tokenExpiry time.Time
}

func New(cfg Config) *Provider {
	return &Provider{
		cfg:    cfg,
		client: &http.Client{Timeout: 20 * time.Second},
		now:    time.Now,
	}
}

func (p *Provider) Name() string { return "mpesa" }

// NormalizePhone accepts the ways Kenyans write Safaricom numbers
// (0712 345 678, +254712345678, 254112345678, 712345678) and returns the
// 2547XXXXXXXX / 2541XXXXXXXX form Daraja requires.
func (p *Provider) NormalizePhone(phone string) (string, error) {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		if r == ' ' || r == '-' || r == '+' || r == '(' || r == ')' {
			return -1
		}
		return 'x'
	}, phone)
	switch {
	case len(digits) == 10 && digits[0] == '0':
		digits = "254" + digits[1:]
	case len(digits) == 9:
		digits = "254" + digits
	}
	if len(digits) != 12 || !strings.HasPrefix(digits, "254") || (digits[3] != '7' && digits[3] != '1') ||
		strings.ContainsRune(digits, 'x') {
		return "", &payments.RejectedError{Reason: "Enter a Safaricom number, for example 0712 345 678."}
	}
	return digits, nil
}

func (p *Provider) Initiate(ctx context.Context, req payments.Request) (payments.Initiation, error) {
	if req.AmountCents <= 0 || req.AmountCents%100 != 0 {
		return payments.Initiation{}, &payments.RejectedError{Reason: "M-Pesa only accepts whole shillings."}
	}
	if len(req.Reference) > maxAccountReference {
		return payments.Initiation{}, fmt.Errorf("mpesa: reference %q exceeds %d characters", req.Reference, maxAccountReference)
	}
	password, timestamp := p.password()
	body := map[string]any{
		"BusinessShortCode": p.cfg.Shortcode,
		"Password":          password,
		"Timestamp":         timestamp,
		"TransactionType":   "CustomerPayBillOnline",
		"Amount":            req.AmountCents / 100,
		"PartyA":            req.Phone,
		"PartyB":            p.cfg.Shortcode,
		"PhoneNumber":       req.Phone,
		"CallBackURL":       p.cfg.CallbackURL,
		"AccountReference":  req.Reference,
		"TransactionDesc":   transactionDesc,
	}
	var out struct {
		ResponseCode        string `json:"ResponseCode"`
		CheckoutRequestID   string `json:"CheckoutRequestID"`
		CustomerMessage     string `json:"CustomerMessage"`
		ResponseDescription string `json:"ResponseDescription"`
		ErrorCode           string `json:"errorCode"`
		ErrorMessage        string `json:"errorMessage"`
	}
	status, err := p.post(ctx, "/mpesa/stkpush/v1/processrequest", body, &out)
	if err != nil {
		return payments.Initiation{}, err
	}
	if status == http.StatusOK && out.ResponseCode == "0" && out.CheckoutRequestID != "" {
		return payments.Initiation{ProviderRef: out.CheckoutRequestID, CustomerMessage: out.CustomerMessage}, nil
	}
	if status >= 400 && status < 500 {
		reason := out.ErrorMessage
		if reason == "" {
			reason = out.ResponseDescription
		}
		return payments.Initiation{}, &payments.RejectedError{Reason: reason}
	}
	return payments.Initiation{}, fmt.Errorf("mpesa stk push: HTTP %d code=%s %s", status, out.ErrorCode, out.ErrorMessage)
}

func (p *Provider) Check(ctx context.Context, providerRef string) (payments.Check, error) {
	password, timestamp := p.password()
	body := map[string]any{
		"BusinessShortCode": p.cfg.Shortcode,
		"Password":          password,
		"Timestamp":         timestamp,
		"CheckoutRequestID": providerRef,
	}
	var out struct {
		ResponseCode string `json:"ResponseCode"`
		ResultCode   string `json:"ResultCode"`
		ResultDesc   string `json:"ResultDesc"`
		ErrorCode    string `json:"errorCode"`
		ErrorMessage string `json:"errorMessage"`
	}
	status, err := p.post(ctx, "/mpesa/stkpushquery/v1/query", body, &out)
	if err != nil {
		return payments.Check{}, err
	}
	switch {
	case out.ErrorCode == stillProcessing:
		return payments.Check{Status: payments.StatusPending}, nil
	case status == http.StatusOK && out.ResultCode == "0":
		return payments.Check{Status: payments.StatusPaid}, nil
	case status == http.StatusOK && out.ResultCode != "":
		// 1032 cancelled by user, 1037 phone unreachable, 1 insufficient
		// funds, 2001 wrong PIN: all final.
		return payments.Check{Status: payments.StatusFailed, Reason: out.ResultDesc}, nil
	}
	return payments.Check{}, fmt.Errorf("mpesa stk query: HTTP %d code=%s %s", status, out.ErrorCode, out.ErrorMessage)
}

func (p *Provider) ParseCallback(r *http.Request) (payments.Callback, error) {
	token := r.URL.Query().Get("token")
	if p.cfg.CallbackToken == "" || subtle.ConstantTimeCompare([]byte(token), []byte(p.cfg.CallbackToken)) != 1 {
		return payments.Callback{}, payments.ErrUnauthenticatedCallback
	}
	var body struct {
		Body struct {
			StkCallback struct {
				CheckoutRequestID string `json:"CheckoutRequestID"`
			} `json:"stkCallback"`
		} `json:"Body"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
		return payments.Callback{}, fmt.Errorf("mpesa callback: %w", err)
	}
	ref := body.Body.StkCallback.CheckoutRequestID
	if ref == "" {
		return payments.Callback{}, fmt.Errorf("mpesa callback: missing CheckoutRequestID")
	}
	return payments.Callback{ProviderRef: ref}, nil
}

func (p *Provider) password() (password, timestamp string) {
	timestamp = p.now().In(eat).Format("20060102150405")
	password = base64.StdEncoding.EncodeToString([]byte(p.cfg.Shortcode + p.cfg.Passkey + timestamp))
	return password, timestamp
}

// post sends an authenticated JSON request and decodes the reply, whatever
// its status: Daraja reports business errors in JSON bodies of 4xx/5xx.
func (p *Provider) post(ctx context.Context, path string, body, out any) (int, error) {
	token, err := p.accessToken(ctx)
	if err != nil {
		return 0, err
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.cfg.BaseURL+path, bytes.NewReader(buf))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := p.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("mpesa %s: %w", path, err)
	}
	defer resp.Body.Close()
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(out); err != nil {
		return resp.StatusCode, fmt.Errorf("mpesa %s: HTTP %d with unreadable body: %w", path, resp.StatusCode, err)
	}
	return resp.StatusCode, nil
}

// accessToken returns a cached OAuth token, fetching a new one a minute
// before the old one expires.
func (p *Provider) accessToken(ctx context.Context) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.token != "" && p.now().Before(p.tokenExpiry) {
		return p.token, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		p.cfg.BaseURL+"/oauth/v1/generate?grant_type=client_credentials", nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(p.cfg.ConsumerKey, p.cfg.ConsumerSecret)
	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("mpesa oauth: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("mpesa oauth: HTTP %d", resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   string `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("mpesa oauth: %w", err)
	}
	ttl := 3599 * time.Second
	if d, err := time.ParseDuration(out.ExpiresIn + "s"); err == nil {
		ttl = d
	}
	p.token = out.AccessToken
	p.tokenExpiry = p.now().Add(ttl - time.Minute)
	return p.token, nil
}
