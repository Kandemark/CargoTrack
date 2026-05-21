package ussd

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/cargotrack/notification/providers"
)

// Server handles USSD callbacks from Africa's Talking.
// Africa's Talking sends POST requests to this server for each
// USSD session interaction. The server supports multiple network
// operators: Safaricom, Airtel Kenya, Vodacom Tanzania, MTN Uganda, etc.
type Server struct {
	atClient *providers.AfricaSTalkingClient
	menuTree *providers.USSDMenuTree
	sessions *providers.USSDSessionStore
	addr     string
}

// NewServer creates a USSD server with the given configuration.
func NewServer(atClient *providers.AfricaSTalkingClient, addr string) *Server {
	sessions := providers.NewUSSDSessionStore()
	menuTree := providers.BuildCargoTrackUSSDMenu(atClient, nil)

	return &Server{
		atClient: atClient,
		menuTree: menuTree,
		sessions: sessions,
		addr:     addr,
	}
}

// Start begins listening for USSD callbacks.
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Main USSD handler — all network operators
	mux.HandleFunc("/ussd", s.handleUSSD)

	// SMS delivery report callback
	mux.HandleFunc("/ussd/delivery", s.handleDeliveryReport)

	// Health check for Africa's Talking
	mux.HandleFunc("/ussd/health", s.handleHealth)

	slog.Info("USSD server listening", "addr", s.addr)
	slog.Info("USSD endpoints: /ussd (session), /ussd/delivery (reports), /ussd/health")
	return http.ListenAndServe(s.addr, mux)
}

// handleUSSD processes an incoming USSD session request.
func (s *Server) handleUSSD(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req providers.USSDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("USSD decode failed", "error", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	slog.Info("USSD session", "session_id", req.SessionID, "phone", maskPhone(req.PhoneNumber),
		"text", req.Text, "network", req.NetworkCode)

	response := s.atClient.HandleUSSD(&req, s.menuTree, s.sessions)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("USSD response encode failed", "error", err)
	}

	if response.ShouldClose {
		slog.Info("USSD session ended", "session_id", req.SessionID, "menu_level", response.MenuLevel)
	}
}

// handleDeliveryReport processes SMS delivery status callbacks.
func (s *Server) handleDeliveryReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var report map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		slog.Error("delivery report decode failed", "error", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	s.atClient.HandleDeliveryReport(report)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleHealth returns the service status.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "healthy",
		"service":      "ussd-gateway",
		"sessions":     len(s.sessions.Sessions()),
		"menu_version": "1.0",
	})
}

// maskPhone hides the middle digits of a phone number for logging.
func maskPhone(phone string) string {
	if len(phone) < 8 {
		return "***"
	}
	return phone[:4] + "***" + phone[len(phone)-3:]
}
