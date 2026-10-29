// Package config reads the core service's settings from the environment.
// Every setting is listed here, with its default, so a deployment can be
// checked against one file.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr    string // CORE_HTTP_ADDR, default ":8080"
	DatabaseURL string // DATABASE_URL, required

	// OIDC (Zitadel). Tokens must be issued by OIDCIssuer for OIDCAudience.
	OIDCIssuer   string // OIDC_ISSUER, required
	OIDCAudience string // OIDC_AUDIENCE, required: the Zitadel project ID

	MinTopUpCents      int64 // BILLING_MIN_TOPUP_KES, default 100
	LowBalanceCents    int64 // BILLING_LOW_BALANCE_KES, default 500
	TopUpCheckInterval int   // BILLING_TOPUP_CHECK_SECONDS, default 5: minimum gap between provider status checks

	MPesa MPesa
}

type MPesa struct {
	Environment    string // MPESA_ENVIRONMENT: sandbox | production
	ConsumerKey    string // MPESA_CONSUMER_KEY
	ConsumerSecret string // MPESA_CONSUMER_SECRET
	Shortcode      string // MPESA_SHORTCODE
	Passkey        string // MPESA_PASSKEY
	// MPESA_CALLBACK_URL must end in ?token=<MPESA_CALLBACK_TOKEN>. Callbacks
	// without the token are dropped before any database work.
	CallbackURL   string
	CallbackToken string
}

// Enabled reports whether M-Pesa credentials are present. Without them the
// provider is not registered and top-ups through it are refused.
func (m MPesa) Enabled() bool { return m.ConsumerKey != "" && m.ConsumerSecret != "" }

func Load() (Config, error) {
	var errs []error
	c := Config{
		HTTPAddr:     env("CORE_HTTP_ADDR", ":8080"),
		DatabaseURL:  required("DATABASE_URL", &errs),
		OIDCIssuer:   strings.TrimSuffix(required("OIDC_ISSUER", &errs), "/"),
		OIDCAudience: required("OIDC_AUDIENCE", &errs),

		MinTopUpCents:      kes("BILLING_MIN_TOPUP_KES", 100, &errs),
		LowBalanceCents:    kes("BILLING_LOW_BALANCE_KES", 500, &errs),
		TopUpCheckInterval: integer("BILLING_TOPUP_CHECK_SECONDS", 5, &errs),

		MPesa: MPesa{
			Environment:    env("MPESA_ENVIRONMENT", "sandbox"),
			ConsumerKey:    env("MPESA_CONSUMER_KEY", ""),
			ConsumerSecret: env("MPESA_CONSUMER_SECRET", ""),
			Shortcode:      env("MPESA_SHORTCODE", ""),
			Passkey:        env("MPESA_PASSKEY", ""),
			CallbackURL:    env("MPESA_CALLBACK_URL", ""),
			CallbackToken:  env("MPESA_CALLBACK_TOKEN", ""),
		},
	}
	if c.MPesa.Enabled() {
		if c.MPesa.CallbackToken == "" || c.MPesa.CallbackURL == "" || c.MPesa.Shortcode == "" || c.MPesa.Passkey == "" {
			errs = append(errs, errors.New(
				"M-Pesa is enabled: MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL and MPESA_CALLBACK_TOKEN are required"))
		}
		if c.MPesa.Environment != "sandbox" && c.MPesa.Environment != "production" {
			errs = append(errs, fmt.Errorf("MPESA_ENVIRONMENT must be sandbox or production, got %q", c.MPesa.Environment))
		}
	}
	return c, errors.Join(errs...)
}

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func required(key string, errs *[]error) string {
	v := os.Getenv(key)
	if v == "" {
		*errs = append(*errs, fmt.Errorf("%s is required", key))
	}
	return v
}

func integer(key string, fallback int, errs *[]error) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		*errs = append(*errs, fmt.Errorf("%s must be a non-negative whole number, got %q", key, v))
		return fallback
	}
	return n
}

func kes(key string, fallback int, errs *[]error) int64 {
	return int64(integer(key, fallback, errs)) * 100
}
