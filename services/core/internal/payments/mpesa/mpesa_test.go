package mpesa

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cargotrack/core/internal/payments"
)

// fakeDaraja answers like Safaricom's sandbox. respond decides the status
// and body for STK push and query calls.
type fakeDaraja struct {
	*httptest.Server
	tokenCalls atomic.Int32
	lastBody   map[string]any
	respond    func(path string) (int, string)
}

func newFakeDaraja(t *testing.T) *fakeDaraja {
	f := &fakeDaraja{}
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/v1/generate" {
			user, pass, ok := r.BasicAuth()
			if !ok || user != "key" || pass != "secret" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			f.tokenCalls.Add(1)
			_, _ = w.Write([]byte(`{"access_token":"tok123","expires_in":"3599"}`))
			return
		}
		if r.Header.Get("Authorization") != "Bearer tok123" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"errorCode":"404.001.03","errorMessage":"Invalid Access Token"}`))
			return
		}
		f.lastBody = map[string]any{}
		_ = json.NewDecoder(r.Body).Decode(&f.lastBody)
		status, body := f.respond(r.URL.Path)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(f.Close)
	return f
}

func newProvider(f *fakeDaraja) *Provider {
	p := New(Config{
		BaseURL: f.URL, ConsumerKey: "key", ConsumerSecret: "secret",
		Shortcode: "174379", Passkey: "pass", CallbackURL: "https://core.example/v1/payments/mpesa/callback?token=s3cret",
		CallbackToken: "s3cret",
	})
	p.now = func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC) }
	return p
}

func TestNormalizePhone(t *testing.T) {
	p := New(Config{})
	ok := map[string]string{
		"0712345678":       "254712345678",
		"0712 345 678":     "254712345678",
		"+254 712-345-678": "254712345678",
		"254112345678":     "254112345678",
		"712345678":        "254712345678",
		"0110345678":       "254110345678",
	}
	for in, want := range ok {
		if got, err := p.NormalizePhone(in); err != nil || got != want {
			t.Errorf("NormalizePhone(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "12345", "0812345678", "256712345678", "07123456789", "07I2345678"} {
		var rejected *payments.RejectedError
		if _, err := p.NormalizePhone(bad); !errors.As(err, &rejected) {
			t.Errorf("NormalizePhone(%q) accepted or wrong error: %v", bad, err)
		}
	}
}

func TestInitiateSendsSTKPush(t *testing.T) {
	f := newFakeDaraja(t)
	f.respond = func(string) (int, string) {
		return 200, `{"MerchantRequestID":"m1","CheckoutRequestID":"ws_CO_1","ResponseCode":"0","ResponseDescription":"Success","CustomerMessage":"Success. Request accepted for processing"}`
	}
	p := newProvider(f)
	init, err := p.Initiate(context.Background(), payments.Request{Reference: "TU0123456789", AmountCents: 150000, Phone: "254712345678"})
	if err != nil {
		t.Fatal(err)
	}
	if init.ProviderRef != "ws_CO_1" {
		t.Fatalf("provider ref = %q", init.ProviderRef)
	}
	b := f.lastBody
	if b["Amount"] != float64(1500) || b["AccountReference"] != "TU0123456789" || b["PhoneNumber"] != "254712345678" {
		t.Fatalf("unexpected STK push body: %v", b)
	}
	// Daraja wants the timestamp in Kenyan time: 12:00 UTC is 15:00 EAT.
	if b["Timestamp"] != "20261029150000" {
		t.Fatalf("timestamp = %v, want EAT", b["Timestamp"])
	}
	want := base64.StdEncoding.EncodeToString([]byte("174379" + "pass" + "20261029150000"))
	if b["Password"] != want {
		t.Fatalf("password = %v, want %v", b["Password"], want)
	}
}

func TestInitiateErrors(t *testing.T) {
	f := newFakeDaraja(t)
	p := newProvider(f)
	req := payments.Request{Reference: "TU0123456789", AmountCents: 10000, Phone: "254712345678"}

	f.respond = func(string) (int, string) {
		return 400, `{"requestId":"r","errorCode":"400.002.02","errorMessage":"Bad Request - Invalid PhoneNumber"}`
	}
	var rejected *payments.RejectedError
	if _, err := p.Initiate(context.Background(), req); !errors.As(err, &rejected) || !strings.Contains(rejected.Reason, "PhoneNumber") {
		t.Fatalf("4xx should be a RejectedError with Daraja's reason, got %v", err)
	}

	f.respond = func(string) (int, string) {
		return 503, `{"errorCode":"503.001.01","errorMessage":"Service unavailable"}`
	}
	if _, err := p.Initiate(context.Background(), req); err == nil || errors.As(err, &rejected) {
		t.Fatalf("5xx should be a transport error, got %v", err)
	}

	if _, err := p.Initiate(context.Background(), payments.Request{Reference: "TU0123456789", AmountCents: 10050}); !errors.As(err, &rejected) {
		t.Fatalf("cents amount should be rejected, got %v", err)
	}
	if _, err := p.Initiate(context.Background(), payments.Request{Reference: "TU01234567890", AmountCents: 10000}); err == nil {
		t.Fatal("13-character account reference accepted; Daraja allows 12")
	}
}

func TestCheck(t *testing.T) {
	f := newFakeDaraja(t)
	p := newProvider(f)
	cases := []struct {
		name   string
		status int
		body   string
		want   payments.Status
	}{
		{"paid", 200, `{"ResponseCode":"0","ResultCode":"0","ResultDesc":"The service request is processed successfully."}`, payments.StatusPaid},
		{"cancelled", 200, `{"ResponseCode":"0","ResultCode":"1032","ResultDesc":"Request cancelled by user"}`, payments.StatusFailed},
		{"still waiting for PIN", 500, `{"requestId":"r","errorCode":"500.001.1001","errorMessage":"The transaction is being processed"}`, payments.StatusPending},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f.respond = func(string) (int, string) { return c.status, c.body }
			got, err := p.Check(context.Background(), "ws_CO_1")
			if err != nil || got.Status != c.want {
				t.Fatalf("Check = %v, %v; want %v", got.Status, err, c.want)
			}
		})
	}
	f.respond = func(string) (int, string) { return 500, `{"errorCode":"500.003.02","errorMessage":"System busy"}` }
	if _, err := p.Check(context.Background(), "ws_CO_1"); err == nil {
		t.Fatal("unknown 500 should be an error, not a result")
	}
}

func TestAccessTokenIsCached(t *testing.T) {
	f := newFakeDaraja(t)
	f.respond = func(string) (int, string) { return 200, `{"ResponseCode":"0","ResultCode":"0","ResultDesc":"ok"}` }
	p := newProvider(f)
	for i := 0; i < 3; i++ {
		if _, err := p.Check(context.Background(), "ws_CO_1"); err != nil {
			t.Fatal(err)
		}
	}
	if n := f.tokenCalls.Load(); n != 1 {
		t.Fatalf("fetched %d OAuth tokens for 3 calls, want 1", n)
	}
}

func TestParseCallbackRequiresToken(t *testing.T) {
	p := New(Config{CallbackToken: "s3cret"})
	body := `{"Body":{"stkCallback":{"MerchantRequestID":"m1","CheckoutRequestID":"ws_CO_1","ResultCode":0,"ResultDesc":"ok"}}}`

	r := httptest.NewRequest(http.MethodPost, "/v1/payments/mpesa/callback?token=wrong", strings.NewReader(body))
	if _, err := p.ParseCallback(r); !errors.Is(err, payments.ErrUnauthenticatedCallback) {
		t.Fatalf("wrong token: %v", err)
	}
	r = httptest.NewRequest(http.MethodPost, "/v1/payments/mpesa/callback?token=s3cret", strings.NewReader(body))
	cb, err := p.ParseCallback(r)
	if err != nil || cb.ProviderRef != "ws_CO_1" {
		t.Fatalf("ParseCallback = %+v, %v", cb, err)
	}

	unset := New(Config{})
	r = httptest.NewRequest(http.MethodPost, "/v1/payments/mpesa/callback?token=", strings.NewReader(body))
	if _, err := unset.ParseCallback(r); !errors.Is(err, payments.ErrUnauthenticatedCallback) {
		t.Fatal("callback accepted with no token configured")
	}
}
