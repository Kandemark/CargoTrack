package providers

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"
)

// EmailProvider sends email via SMTP.
type EmailProvider struct {
	host     string
	port     int
	user     string
	password string
	from     string
}

func NewEmailProvider(host string, port int, user, password, from string) *EmailProvider {
	return &EmailProvider{host: host, port: port, user: user, password: password, from: from}
}

func (p *EmailProvider) Name() string { return "email" }

func (p *EmailProvider) Send(ctx context.Context, msg *Message) error {
	addr := fmt.Sprintf("%s:%d", p.host, p.port)
	to := []string{msg.Recipient}

	var body strings.Builder
	body.WriteString(fmt.Sprintf("From: %s\r\n", p.from))
	body.WriteString(fmt.Sprintf("To: %s\r\n", msg.Recipient))
	body.WriteString(fmt.Sprintf("Subject: %s\r\n", msg.Title))
	body.WriteString("MIME-Version: 1.0\r\n")
	body.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
	body.WriteString("\r\n")
	body.WriteString(msg.Body)

	var auth smtp.Auth
	if p.user != "" {
		auth = smtp.PlainAuth("", p.user, p.password, p.host)
	}

	done := make(chan error, 1)
	go func() {
		done <- smtp.SendMail(addr, auth, p.from, to, []byte(body.String()))
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("smtp send: %w", err)
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
