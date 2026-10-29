// Package httpx holds the JSON request/response helpers and the one error
// shape every endpoint returns:
//
//	{"error": "insufficient_credit", "message": "...", "details": {...}}
//
// "error" is a stable machine-readable code clients can switch on;
// "message" is for people and may change.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

const maxBodyBytes = 1 << 20

// Error is an error with an HTTP status and a stable code. Handlers return
// it; anything else becomes a 500 with no internals leaked to the client.
type Error struct {
	Status  int            `json:"-"`
	Code    string         `json:"error"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("%d %s: %s", e.Status, e.Code, e.Message) }

func NewError(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func BadRequest(message string) *Error {
	return NewError(http.StatusBadRequest, "invalid_request", message)
}

var (
	ErrUnauthorized = NewError(http.StatusUnauthorized, "unauthorized", "A valid access token is required.")
	ErrForbidden    = NewError(http.StatusForbidden, "forbidden", "Your role does not allow this action.")
	ErrNotFound     = NewError(http.StatusNotFound, "not_found", "Not found.")
)

// HandlerFunc is an http.HandlerFunc that returns an error instead of
// writing it, so every failure goes through WriteError.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

func Handle(h HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := h(w, r); err != nil {
			WriteError(w, r, err)
		}
	})
}

func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var he *Error
	if !errors.As(err, &he) {
		slog.ErrorContext(r.Context(), "unhandled error", "method", r.Method, "path", r.URL.Path, "err", err)
		he = NewError(http.StatusInternalServerError, "internal", "Something went wrong on our side.")
	}
	WriteJSON(w, he.Status, he)
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write response", "err", err)
	}
}

// Decode reads a JSON body into v, rejecting unknown fields and bodies
// over 1 MiB.
func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return BadRequest("Request body is not valid JSON for this endpoint: " + err.Error())
	}
	return nil
}

// IsUUID reports whether s is a canonical UUID, so path parameters can be
// rejected as not found before reaching a uuid column.
func IsUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch i {
		case 8, 13, 18, 23:
			if c != '-' {
				return false
			}
		default:
			if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
				return false
			}
		}
	}
	return true
}

// Recover turns a panic in a handler into a logged 500 instead of a
// dropped connection.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				WriteError(w, r, fmt.Errorf("panic: %v", v))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
