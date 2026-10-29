package shipments

import (
	"crypto/rand"
	"math/big"
	"strings"
	"time"
)

type Status string

const (
	Booked    Status = "booked"
	PickedUp  Status = "picked_up"
	InTransit Status = "in_transit"
	Customs   Status = "customs" // at a border post or in port clearance
	Exception Status = "exception"
	Delivered Status = "delivered"
	Cancelled Status = "cancelled"
)

// transitions lists, for each status, the statuses a shipment may move to.
// Anything else is refused, so a shipment cannot jump from booked to
// delivered by a mis-tap, and the history clients see stays believable.
var transitions = map[Status][]Status{
	Booked:    {PickedUp, Cancelled},
	PickedUp:  {InTransit, Customs, Delivered, Exception},
	InTransit: {Customs, Delivered, Exception},
	Customs:   {InTransit, Delivered, Exception},
	Exception: {InTransit, Customs, Delivered, Cancelled},
	Delivered: {},
	Cancelled: {},
}

func (s Status) Valid() bool {
	_, ok := transitions[s]
	return ok
}

func (s Status) CanMoveTo(next Status) bool {
	for _, allowed := range transitions[s] {
		if allowed == next {
			return true
		}
	}
	return false
}

// Final statuses accept no checkpoints or delays, only notes.
func (s Status) Final() bool { return s == Delivered || s == Cancelled }

// Shipment is the owner's full view.
type Shipment struct {
	ID                 string     `json:"id"`
	OrgID              string     `json:"org_id"`         // the shipper, who booked and paid
	CarrierOrgID       *string    `json:"carrier_org_id"` // awarded carrier, if any
	TrackingNumber     string     `json:"tracking_number"`
	Reference          string     `json:"reference"`
	Status             Status     `json:"status"`
	OriginName         string     `json:"origin_name"`
	OriginCountry      string     `json:"origin_country"`
	DestinationName    string     `json:"destination_name"`
	DestinationCountry string     `json:"destination_country"`
	CargoDescription   string     `json:"cargo_description"`
	WeightKg           float64    `json:"weight_kg"`
	Pieces             int        `json:"pieces"`
	PickupAt           time.Time  `json:"pickup_at"`
	DeliverBy          time.Time  `json:"deliver_by"`
	PickedUpAt         *time.Time `json:"picked_up_at"`
	DeliveredAt        *time.Time `json:"delivered_at"`
	VehicleID          *string    `json:"vehicle_id"`
	DriverID           *string    `json:"driver_id"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	seq                int64
	fleetOrgID         string // whose vehicles and drivers may be assigned
}

type Event struct {
	ID         int64     `json:"id"`
	Kind       string    `json:"kind"`
	FromStatus *Status   `json:"from_status"`
	ToStatus   *Status   `json:"to_status"`
	Location   string    `json:"location"`
	Latitude   *float64  `json:"latitude"`
	Longitude  *float64  `json:"longitude"`
	Note       string    `json:"note"`
	Internal   bool      `json:"internal"`
	OccurredAt time.Time `json:"occurred_at"`
	RecordedBy *string   `json:"recorded_by"`
	CreatedAt  time.Time `json:"created_at"`
}

// trackingAlphabet leaves out 0/O, 1/I/L so numbers survive being read
// over the phone or copied from a waybill.
const trackingAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

// newTrackingNumber returns CT plus 10 random characters: about 8×10^14
// possibilities, so public tracking numbers cannot be guessed.
func newTrackingNumber() string {
	var b strings.Builder
	b.WriteString("CT")
	max := big.NewInt(int64(len(trackingAlphabet)))
	for i := 0; i < 10; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic(err) // crypto/rand does not fail on supported platforms
		}
		b.WriteByte(trackingAlphabet[n.Int64()])
	}
	return b.String()
}

// normalizeTrackingNumber forgives the usual ways people type a number:
// lower case, spaces, dashes.
func normalizeTrackingNumber(s string) string {
	s = strings.ToUpper(s)
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, s)
}
