package providers

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// USSDMenuTree defines the USSD menu structure for CargoTrack.
// Drivers and logistics staff interact via shortcodes (e.g., *384#).
type USSDMenuTree struct {
	Root *USSDMenuNode
}

// USSDMenuNode is a single node in the USSD menu tree.
type USSDMenuNode struct {
	ID       string
	Title    string
	Children map[string]*USSDMenuNode // input -> next node
	Action   func(session *USSDSession) (*USSDResponse, error)
}

// Display renders the menu options as USSD text.
func (n *USSDMenuNode) Display() string {
	out := n.Title + "\n"
	i := 1
	children := make([]struct {
		key  string
		node *USSDMenuNode
	}, 0, len(n.Children))
	for k, v := range n.Children {
		children = append(children, struct {
			key  string
			node *USSDMenuNode
		}{k, v})
	}
	for _, c := range children {
		out += fmt.Sprintf("%s. %s\n", c.key, c.node.Title)
		i++
	}
	return out
}

// USSDSessionStore manages USSD sessions with TTL.
type USSDSessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*USSDSession
}

// NewUSSDSessionStore creates a new session store.
func NewUSSDSessionStore() *USSDSessionStore {
	store := &USSDSessionStore{
		sessions: make(map[string]*USSDSession),
	}
	// Background cleanup of expired sessions
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			store.cleanup(30 * time.Minute)
		}
	}()
	return store
}

// GetOrCreate returns existing session or creates a new one.
func (s *USSDSessionStore) GetOrCreate(sessionID, phone, serviceCode, network string) *USSDSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	if session, ok := s.sessions[sessionID]; ok {
		return session
	}

	session := &USSDSession{
		SessionID:   sessionID,
		PhoneNumber: phone,
		ServiceCode: serviceCode,
		NetworkCode: network,
		Data:        make(map[string]string),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.sessions[sessionID] = session
	return session
}

// Remove deletes a session (on USSD END).
func (s *USSDSessionStore) Remove(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

// Sessions returns all active sessions (for health checks).
func (s *USSDSessionStore) Sessions() []*USSDSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*USSDSession, 0, len(s.sessions))
	for _, session := range s.sessions {
		result = append(result, session)
	}
	return result
}

// Get retrieves a session by ID.
func (s *USSDSessionStore) Get(sessionID string) *USSDSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessions[sessionID]
}

func (s *USSDSessionStore) cleanup(ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cutoff := time.Now().Add(-ttl)
	for id, session := range s.sessions {
		if session.UpdatedAt.Before(cutoff) {
			delete(s.sessions, id)
		}
	}
}

// ── CargoTrack USSD Menu Tree ──────────────────────────────────────────────

// BuildCargoTrackUSSDMenu creates the complete USSD menu for drivers and staff.
func BuildCargoTrackUSSDMenu(atClient *AfricaSTalkingClient, smsProv *SMSProvider) *USSDMenuTree {
	tree := &USSDMenuTree{}

	// Root menu — driver main page
	root := &USSDMenuNode{
		ID:    "root",
		Title: "CargoTrack Driver Portal",
		Children: make(map[string]*USSDMenuNode),
	}

	// 1. My Shipments
	myShipments := &USSDMenuNode{
		ID:    "my_shipments",
		Title: "My Shipments",
		Children: map[string]*USSDMenuNode{
			"1": {
				ID:    "shipment_pending",
				Title: "Pending / Assigned",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     fmt.Sprintf("END Shipments for %s:\nDelivery #CT-001: Mombasa->Nairobi\nStatus: In Transit\nCall support: +254 700 000000", formatPhone(s.PhoneNumber)),
						ShouldClose: true,
					}, nil
				},
			},
			"2": {
				ID:    "shipment_active",
				Title: "In Transit",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END Active shipments:\n#CT-001: In Transit (Nairobi)\n#CT-002: Customs (Busia)\nReply 0 for menu.",
						ShouldClose: true,
					}, nil
				},
			},
			"3": {
				ID:    "shipment_completed",
				Title: "Delivered",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END Completed deliveries this week:\n#CT-098: Nairobi ✅\n#CT-097: Mombasa ✅\nTotal: 2 deliveries",
						ShouldClose: true,
					}, nil
				},
			},
		},
	}

	// 2. Update Status
	updateStatus := &USSDMenuNode{
		ID:    "update_status",
		Title: "Update Shipment Status",
		Children: map[string]*USSDMenuNode{
			"1": {
				ID:    "status_departed",
				Title: "Confirm Departure",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "CON Enter shipment tracking number:\n(or 0 to cancel)",
						ShouldClose: false,
					}, nil
				},
			},
			"2": {
				ID:    "status_arrived",
				Title: "Confirm Arrival",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "CON Enter shipment tracking number:\n(or 0 to cancel)",
						ShouldClose: false,
					}, nil
				},
			},
			"3": {
				ID:    "status_border",
				Title: "Border Crossing Check-in",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "CON Select border crossing:\n1. Busia\n2. Malaba\n3. Namanga\n4. Taveta\n5. Rusumo\n6. Mutukula",
						ShouldClose: false,
					}, nil
				},
			},
			"4": {
				ID:    "status_delay",
				Title: "Report Delay",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "CON Select delay reason:\n1. Traffic\n2. Weather\n3. Customs\n4. Mechanical\n5. Other",
						ShouldClose: false,
					}, nil
				},
			},
		},
	}

	// 3. Request Assistance
	requestHelp := &USSDMenuNode{
		ID:    "request_help",
		Title: "Request Assistance",
		Children: map[string]*USSDMenuNode{
			"1": {
				ID:    "help_breakdown",
				Title: "Mechanical Breakdown",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					// Send alert SMS to fleet manager
					go func() {
						if smsProv != nil {
							msg := &Message{
								Recipient:   "+254700000000", // fleet manager
								Channel:     "sms",
								Title:       "Driver Breakdown Alert",
								Body:        fmt.Sprintf("Driver %s needs roadside assistance. Location: near %s border.", formatPhone(s.PhoneNumber), s.Data["location"]),
								TemplateRef: "breakdown_alert",
							}
							_ = smsProv.Send(context.Background(), msg)
						}
					}()
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END Help is on the way. Your fleet manager has been notified.\nEmergency: +254 700 000000",
						ShouldClose: true,
					}, nil
				},
			},
			"2": {
				ID:    "help_security",
				Title: "Security Incident",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					go func() {
						if smsProv != nil {
							msg := &Message{
								Recipient:   "+254700000000",
								Channel:     "sms",
								Title:       "URGENT: Security Incident",
								Body:        fmt.Sprintf("Driver %s reported security incident. Immediate response required.", formatPhone(s.PhoneNumber)),
								TemplateRef: "security_alert",
							}
							_ = smsProv.Send(context.Background(), msg)
						}
					}()
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END Security alert sent. Help dispatched.\nEmergency: +254 700 000000",
						ShouldClose: true,
					}, nil
				},
			},
			"3": {
				ID:    "help_medical",
				Title: "Medical Emergency",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END CALL 999 or 112 NOW.\nEmergency services have been notified for your area.",
						ShouldClose: true,
					}, nil
				},
			},
		},
	}

	// 4. Account
	account := &USSDMenuNode{
		ID:    "account",
		Title: "My Account",
		Children: map[string]*USSDMenuNode{
			"1": {
				ID:    "account_earnings",
				Title: "This Week's Earnings",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     "END Your earnings this week:\nCompleted: 2 trips\nTotal: KES 45,000\nPending: KES 12,000",
						ShouldClose: true,
					}, nil
				},
			},
			"2": {
				ID:    "account_profile",
				Title: "My Profile",
				Action: func(s *USSDSession) (*USSDResponse, error) {
					return &USSDResponse{
						SessionID:   s.SessionID,
						Message:     fmt.Sprintf("END Driver Profile:\nPhone: %s\nRating: 4.8/5\nTruck: KCB 456T\nCarrier: EAC Logistics", formatPhone(s.PhoneNumber)),
						ShouldClose: true,
					}, nil
				},
			},
		},
	}

	root.Children["1"] = myShipments
	root.Children["2"] = updateStatus
	root.Children["3"] = requestHelp
	root.Children["4"] = account

	tree.Root = root
	return tree
}

func formatPhone(phone string) string {
	if len(phone) >= 9 {
		return "****" + phone[len(phone)-4:]
	}
	return phone
}
