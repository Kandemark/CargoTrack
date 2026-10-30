package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	h := CORS([]string{"https://app.example.com/", " "}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))

	pre := httptest.NewRequest(http.MethodOptions, "/v1/shipments", nil)
	pre.Header.Set("Origin", "https://app.example.com")
	pre.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, pre)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" ||
		rec.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Fatalf("preflight from allowed origin: %d %v", rec.Code, rec.Header())
	}

	get := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	get.Header.Set("Origin", "https://app.example.com")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, get)
	if rec.Code != http.StatusTeapot || rec.Header().Get("Access-Control-Expose-Headers") != "Idempotent-Replayed" {
		t.Fatalf("request from allowed origin: %d %v", rec.Code, rec.Header())
	}

	evil := httptest.NewRequest(http.MethodOptions, "/v1/me", nil)
	evil.Header.Set("Origin", "https://evil.example")
	evil.Header.Set("Access-Control-Request-Method", "GET")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, evil)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("unlisted origin got CORS headers: %v", rec.Header())
	}
}
