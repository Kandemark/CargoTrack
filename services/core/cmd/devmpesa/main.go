// Command devmpesa simulates Safaricom's Daraja API on a development
// machine, so the core's real M-Pesa code (STK Push, callback, STK Push
// Query) runs end to end without Safaricom credentials. It is never built
// into the core image and must never be deployed.
//
// Point the core at it with MPESA_BASE_URL. A prompt is "paid" a few
// seconds after it is sent, then the callback is delivered. A phone number
// ending in 000 simulates the customer cancelling (result code 1032).
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type payment struct {
	resultCode string
	resultDesc string
	settled    bool
}

type server struct {
	delay time.Duration
	mu    sync.Mutex
	pays  map[string]*payment
}

func main() {
	addr := flag.String("addr", ":9100", "listen address")
	delay := flag.Duration("delay", 6*time.Second, "time before a prompt is answered")
	flag.Parse()
	s := &server{delay: *delay, pays: map[string]*payment{}}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /oauth/v1/generate", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"access_token": "dev-token", "expires_in": "3599"})
	})
	mux.HandleFunc("POST /mpesa/stkpush/v1/processrequest", s.stkPush)
	mux.HandleFunc("POST /mpesa/stkpushquery/v1/query", s.query)
	log.Printf("devmpesa: DEVELOPMENT ONLY M-Pesa simulator on %s (prompts answered after %s)", *addr, *delay)
	log.Fatal(http.ListenAndServe(*addr, mux))
}

func (s *server) stkPush(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Amount           int64
		PhoneNumber      string
		CallBackURL      string
		AccountReference string
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 || len(req.PhoneNumber) != 12 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"errorCode": "400.002.02", "errorMessage": "Bad Request - Invalid PhoneNumber",
		})
		return
	}
	id := "ws_CO_DEV_" + randomHex(8)
	p := &payment{}
	s.mu.Lock()
	s.pays[id] = p
	s.mu.Unlock()
	log.Printf("STK push %s: KES %d to %s, account %s", id, req.Amount, req.PhoneNumber, req.AccountReference)

	go func() {
		time.Sleep(s.delay)
		code, desc := "0", "The service request is processed successfully."
		if strings.HasSuffix(req.PhoneNumber, "000") {
			code, desc = "1032", "Request cancelled by user"
		}
		s.mu.Lock()
		p.resultCode, p.resultDesc, p.settled = code, desc, true
		s.mu.Unlock()
		log.Printf("STK push %s answered: %s %s", id, code, desc)
		s.callback(req.CallBackURL, id, code, desc)
	}()

	writeJSON(w, http.StatusOK, map[string]string{
		"MerchantRequestID": "dev-" + randomHex(4), "CheckoutRequestID": id, "ResponseCode": "0",
		"ResponseDescription": "Success. Request accepted for processing",
		"CustomerMessage":     "Success. Request accepted for processing",
	})
}

func (s *server) callback(url, id, code, desc string) {
	resultCode := 0
	_, _ = fmt.Sscan(code, &resultCode)
	body, _ := json.Marshal(map[string]any{"Body": map[string]any{"stkCallback": map[string]any{
		"MerchantRequestID": "dev", "CheckoutRequestID": id, "ResultCode": resultCode, "ResultDesc": desc,
	}}})
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("callback to %s failed: %v (the core's reconciler will catch up)", url, err)
		return
	}
	resp.Body.Close()
	log.Printf("callback delivered: HTTP %d", resp.StatusCode)
}

func (s *server) query(w http.ResponseWriter, r *http.Request) {
	var req struct{ CheckoutRequestID string }
	_ = json.NewDecoder(r.Body).Decode(&req)
	s.mu.Lock()
	p, ok := s.pays[req.CheckoutRequestID]
	var settled bool
	var code, desc string
	if ok {
		settled, code, desc = p.settled, p.resultCode, p.resultDesc
	}
	s.mu.Unlock()
	switch {
	case !ok:
		writeJSON(w, http.StatusBadRequest, map[string]string{"errorCode": "400.002.02", "errorMessage": "Invalid CheckoutRequestID"})
	case !settled:
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"errorCode": "500.001.1001", "errorMessage": "The transaction is being processed",
		})
	default:
		writeJSON(w, http.StatusOK, map[string]string{"ResponseCode": "0", "ResultCode": code, "ResultDesc": desc})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%X", b)
}
