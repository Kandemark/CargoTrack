package dispatcher

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
	"time"
)

// NotificationEvent is the raw Kafka event from any alert/notification topic.
type NotificationEvent struct {
	UserID    string            `json:"user_id"`
	Type      string            `json:"type"`
	Title     string            `json:"title"`
	Body      string            `json:"body"`
	ActionURL string            `json:"action_url"`
	Timestamp time.Time         `json:"created_at"`
	Recipient string            `json:"recipient"`  // resolved by recipient resolver
	Channels  []string          `json:"channels"`   // push, sms, email, whatsapp
	Metadata  map[string]string `json:"metadata"`
}

// TemplateEngine renders per-channel message bodies from Go templates.
type TemplateEngine struct {
	templates map[string]*template.Template
}

func NewTemplateEngine() *TemplateEngine {
	// Default built-in templates; production would load from filesystem.
	defaults := map[string]string{
		"push_default":     "{{ .Title }}",
		"sms_default":      "{{ .Title }}: {{ .Body }}",
		"email_default":    "{{ .Title }}\n\n{{ .Body }}\n\nTrack: {{ .ActionURL }}",
		"whatsapp_default": "*{{ .Title }}*\n\n{{ .Body }}\n\n{{ .ActionURL }}",
	}

	engine := &TemplateEngine{templates: make(map[string]*template.Template)}
	for name, tmpl := range defaults {
		t, err := template.New(name).Parse(tmpl)
		if err != nil {
			panic(fmt.Sprintf("broken built-in template %s: %v", name, err))
		}
		engine.templates[name] = t
	}
	return engine
}

// Render applies the template for the given channel to the event.
func (e *TemplateEngine) Render(channel string, evt *NotificationEvent) (string, string, error) {
	tmplName := channel + "_default"
	tmpl, ok := e.templates[tmplName]
	if !ok {
		// Fall back to plain body
		return evt.Title, evt.Body, nil
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, evt); err != nil {
		return "", "", fmt.Errorf("template render %s: %w", tmplName, err)
	}

	rendered := buf.String()
	// For push/SMS — return title + rendered body
	if channel == "push" || channel == "sms" {
		return evt.Title, rendered, nil
	}
	// For email/whatsapp — title + full rendered text
	return evt.Title, rendered, nil
}

// SanitizePhone strips whitespace and ensures E.164 format for African numbers.
func SanitizePhone(raw string) string {
	s := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' || r == '+' {
			return r
		}
		return -1
	}, raw)

	if strings.HasPrefix(s, "0") {
		// Assume East African number, convert to +254/+255/+256 etc.
		// This is a simplified heuristic; production needs a country-code lookup.
		return "+254" + s[1:] // Default Kenya; override per country config
	}
	if !strings.HasPrefix(s, "+") {
		return "+" + s
	}
	return s
}
