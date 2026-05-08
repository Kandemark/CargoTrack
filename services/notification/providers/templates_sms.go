package providers

// Logistics SMS templates for Africa's Talking and Twilio.
// These are pre-rendered text templates keyed by notification type.

// SMSTemplate represents a pre-built SMS message template.
type SMSTemplate struct {
	TemplateRef string
	Title       string
	Body        string // may contain {{placeholders}}
}

// LogisticsSMSTemplates returns templates for all logistics notification scenarios.
func LogisticsSMSTemplates() map[string]SMSTemplate {
	return map[string]SMSTemplate{
		// ── Shipment lifecycle ──────────────────────────────────────────
		"shipment_assigned": {
			TemplateRef: "shipment_assigned",
			Title:       "New Shipment Assigned",
			Body: "CargoTrack: Shipment {{.TrackingNumber}} assigned.\n" +
				"Route: {{.Origin}} -> {{.Destination}}\n" +
				"Pickup: {{.ScheduledDeparture}}\n" +
				"Weight: {{.WeightKg}} kg\n" +
				"Reply with 1 to accept, 2 to decline.",
		},
		"shipment_departed": {
			TemplateRef: "shipment_departed",
			Title:       "Departure Confirmed",
			Body: "CargoTrack: {{.TrackingNumber}} departed {{.Origin}} at {{.DepartureTime}}.\n" +
				"ETA {{.Destination}}: {{.ETA}}",
		},
		"shipment_arrived": {
			TemplateRef: "shipment_arrived",
			Title:       "Delivery Confirmed",
			Body: "CargoTrack: {{.TrackingNumber}} delivered to {{.Destination}} at {{.ArrivalTime}}.\n" +
				"POD reference: {{.PODRef}}",
		},
		"shipment_delayed": {
			TemplateRef: "shipment_delayed",
			Title:       "Shipment Delayed",
			Body: "CargoTrack: {{.TrackingNumber}} is delayed.\n" +
				"Reason: {{.DelayReason}}\n" +
				"New ETA: {{.NewETA}}\n" +
				"Reply STATUS for updates.",
		},

		// ── Border crossing ─────────────────────────────────────────────
		"border_approaching": {
			TemplateRef: "border_approaching",
			Title:       "Approaching Border",
			Body: "CargoTrack: Approaching {{.BorderName}} border.\n" +
				"Est. wait time: {{.WaitTimeMin}} min\n" +
				"Have documents ready:\n" +
				"- {{.RequiredDocs}}\n" +
				"Use USSD *384# to check in at border.",
		},
		"border_cleared": {
			TemplateRef: "border_cleared",
			Title:       "Border Cleared",
			Body: "CargoTrack: {{.TrackingNumber}} cleared {{.BorderName}}.\n" +
				"Clearance time: {{.ClearanceTimeMin}} min\n" +
				"Next checkpoint: {{.NextCheckpoint}}",
		},
		"customs_hold": {
			TemplateRef: "customs_hold",
			Title:       "Customs Hold",
			Body: "URGENT CargoTrack: {{.TrackingNumber}} held at {{.CustomsOffice}}.\n" +
				"Reason: {{.HoldReason}}\n" +
				"Action: {{.RequiredAction}}\n" +
				"Contact: {{.CustomsContact}}",
		},

		// ── Payment ─────────────────────────────────────────────────────
		"payment_received": {
			TemplateRef: "payment_received",
			Title:       "Payment Received",
			Body: "CargoTrack: Payment of {{.Amount}} {{.Currency}} received for {{.TrackingNumber}}.\n" +
				"Ref: {{.PaymentRef}}\n" +
				"Balance: {{.Balance}}",
		},
		"payment_due": {
			TemplateRef: "payment_due",
			Title:       "Payment Due",
			Body: "CargoTrack: Payment of {{.Amount}} {{.Currency}} due for {{.TrackingNumber}}.\n" +
				"Due date: {{.DueDate}}\n" +
				"Pay via M-Pesa: Paybill {{.PaybillNo}}, A/C {{.AccountNo}}",
		},

		// ── Fleet alerts ────────────────────────────────────────────────
		"maintenance_due": {
			TemplateRef: "maintenance_due",
			Title:       "Maintenance Due",
			Body: "CargoTrack: Truck {{.Registration}} is due for {{.MaintenanceType}}.\n" +
				"Mileage: {{.MileageKm}} km\n" +
				"Scheduled: {{.ScheduledDate}}\n" +
				"Reply BOOK to confirm appointment.",
		},
		"fuel_alert": {
			TemplateRef: "fuel_alert",
			Title:       "Low Fuel Alert",
			Body: "CargoTrack: Truck {{.Registration}} fuel level {{.FuelPercent}}%.\n" +
				"Nearest fuel stop: {{.NearestStation}} ({{.DistanceKm}} km)\n" +
				"Estimated range: {{.RangeKm}} km",
		},
		"geofence_breach": {
			TemplateRef: "geofence_breach",
			Title:       "Route Deviation",
			Body: "CargoTrack: Truck {{.Registration}} deviated from route.\n" +
				"Current location: {{.CurrentLocation}}\n" +
				"Expected corridor: {{.ExpectedCorridor}}\n" +
				"Reply STATUS or call dispatch.",
		},

		// ── Driver notifications ────────────────────────────────────────
		"driver_incentive": {
			TemplateRef: "driver_incentive",
			Title:       "Performance Bonus",
			Body: "Congratulations! CargoTrack: You earned a {{.BonusAmount}} {{.Currency}} bonus for on-time delivery of {{.TrackingNumber}}!\n" +
				"Rating: {{.Rating}}/5\n" +
				"Keep up the great work!",
		},
		"rest_reminder": {
			TemplateRef: "rest_reminder",
			Title:       "Rest Break Reminder",
			Body: "CargoTrack: You've been driving {{.HoursDriven}} hours.\n" +
				"Mandatory rest break required.\n" +
				"Next rest stop: {{.RestStop}} ({{.DistanceKm}} km)\n" +
				"Drive safely!",
		},

		// ── Cold chain ──────────────────────────────────────────────────
		"cold_chain_excursion": {
			TemplateRef: "cold_chain_excursion",
			Title:       "Temperature Excursion",
			Body: "URGENT CargoTrack: Reefer {{.Registration}} temp {{.CurrentTemp}}°C outside range ({{.MinTemp}}-{{.MaxTemp}}°C).\n" +
				"{{.TrackingNumber}}: {{.Commodity}}\n" +
				"Action required immediately!",
		},

		// ── Marketplace ─────────────────────────────────────────────────
		"bid_won": {
			TemplateRef: "bid_won",
			Title:       "Bid Accepted",
			Body: "CargoTrack: Your bid of {{.BidAmount}} {{.Currency}} for {{.TrackingNumber}} was accepted!\n" +
				"Route: {{.Origin}} -> {{.Destination}}\n" +
				"Pickup: {{.PickupDate}}",
		},
		"bid_lost": {
			TemplateRef: "bid_lost",
			Title:       "Bid Not Accepted",
			Body: "CargoTrack: Your bid for {{.TrackingNumber}} was not accepted.\n" +
				"Winning bid: {{.WinningBid}} {{.Currency}}\n" +
				"Browse more loads: *384#",
		},
	}
}
