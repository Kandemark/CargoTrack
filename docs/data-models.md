# CargoTrack Data Models

All models use PostgreSQL 16 with TimescaleDB 2.16 extension for time-series data. Django's `BigAutoField` is used for all primary keys to avoid the 2-billion row limit.

---

## accounts — User & Organization Models

### CustomUser (AUTH_USER_MODEL)
Central user model with 9 roles for role-based access control.

| Field | Type | Description |
|---|---|---|
| `username` | CharField(150) | Unique username (email-based) |
| `email` | EmailField | User email address |
| `first_name` | CharField(150) | First name |
| `last_name` | CharField(150) | Last name |
| `role` | CharField(20) | One of 9 roles (ADMIN, LOGISTICS_MGR, CLIENT, CARRIER, DRIVER, DISPATCHER, CUSTOMS_BROKER, WAREHOUSE_MGR, PORT_AGENT, FINANCE_OFFICER) |
| `phone` | EncryptedTextField(20) | Phone number (AES-256-GCM encrypted) |
| `organization` | FK → Organization | User's organization |
| `onboarding_completed` | BooleanField | Onboarding flow completed |
| `totp_secret` | EncryptedTextField(64) | TOTP 2FA secret |
| `totp_enabled` | BooleanField | 2FA enabled flag |
| `totp_backup_codes` | JSONField | Hashed backup codes |
| `failed_login_attempts` | PositiveSmallIntegerField | Failed login counter |
| `locked_until` | DateTimeField | Account lockout expiry |
| `created_at` | DateTimeField | Auto-set on creation |

**Role Permissions**:
- `can_create_shipments()` — ADMIN, LOGISTICS_MGR, DISPATCHER, WAREHOUSE_MGR
- `can_log_events()` — ADMIN, LOGISTICS_MGR, CARRIER, DRIVER, DISPATCHER, PORT_AGENT
- `can_capture_pod()` — ADMIN, DRIVER, CARRIER, DISPATCHER, WAREHOUSE_MGR
- `can_manage_finances()` — ADMIN, FINANCE_OFFICER, LOGISTICS_MGR
- `can_clear_customs()` — ADMIN, CUSTOMS_BROKER, PORT_AGENT

### UserProfile
One-to-one extension of CustomUser. Auto-created via signals.

| Field | Type | Description |
|---|---|---|
| `user` | OneToOne → CustomUser | Parent user |
| `notification_prefs` | JSONField | Notification channel preferences |
| `display_prefs` | JSONField | UI display and locale preferences |

### APIKey
Per-user API key for programmatic access. Full key shown once (SHA-256 stored).

| Field | Type | Description |
|---|---|---|
| `user` | FK → CustomUser | Key owner |
| `name` | CharField(100) | Human-readable name |
| `prefix` | CharField(8) | First 8 chars (ct_xxxx…) |
| `hashed_key` | CharField(64) | SHA-256 hash of full key |

### Notification
In-app notification system.

| Field | Type | Description |
|---|---|---|
| `user` | FK → CustomUser | Recipient |
| `type` | CharField(20) | ALERT, SHIPMENT, PAYMENT, SYSTEM, SECURITY |
| `title` | CharField(300) | Notification title |
| `message` | TextField | Notification body |
| `severity` | CharField(10) | HIGH, MEDIUM, LOW, INFO |
| `is_read` | BooleanField | Read status |
| `is_dismissed` | BooleanField | Soft-delete flag |

### AuditEntry
Immutable security audit log.

| Field | Type | Description |
|---|---|---|
| `user` | FK → CustomUser | Actor (nullable for system events) |
| `action` | CharField(20) | CREATE, UPDATE, DELETE, LOGIN, EXPORT, VIEW |
| `resource` | CharField(200) | Affected resource identifier |
| `description` | TextField | Human-readable description |
| `ip_address` | GenericIPAddressField | Client IP |
| `result` | CharField(10) | SUCCESS, FAILURE, WARNING |
| `metadata` | JSONField | Additional context (user agent, etc.) |

### Integration
External system integration configuration.

| Field | Type | Description |
|---|---|---|
| `name` | CharField(200) | Integration name |
| `category` | CharField(20) | CUSTOMS, PORT, CARRIER, PAYMENTS, FINANCE, MAPS, COMMS |
| `status` | CharField(20) | CONNECTED, DISCONNECTED, ERROR |
| `api_url` | URLField | API endpoint |
| `has_webhook` | BooleanField | Webhook configured |
| `config` | JSONField | Integration-specific configuration |

### Organization
Company, carrier firm, brokerage, or independent operator.

| Field | Type | Description |
|---|---|---|
| `name` | CharField(200) | Organization name (unique) |
| `slug` | SlugField(200) | URL-friendly slug |
| `org_type` | CharField(20) | FREIGHT_FORWARDER, CARRIER_COMPANY, SHIPPER, BROKERAGE, INDEPENDENT |
| `logo_url` | URLField | Logo URL |
| `website` | URLField | Company website |
| `country` | CharField(100) | Country (default: Kenya) |
| `tax_id` | EncryptedTextField(50) | Tax ID (AES-256-GCM encrypted) |
| `invite_code` | CharField(20) | Auto-generated org invite code |

---

## shipments — Core Shipment Models

### Route
Named origin-to-destination path shared across shipments.

| Field | Type | Description |
|---|---|---|
| `origin` | CharField(100) | Origin city/port |
| `destination` | CharField(100) | Destination city/port |
| `distance_km` | FloatField | Distance in kilometers |
| `estimated_hours` | FloatField | Estimated travel time |

### Shipment
Central domain model with dual state machines.

| Field | Type | Description |
|---|---|---|
| `tracking_number` | CharField(20) | Auto-generated (CT-YYYYMMDD-XXXX) |
| `route` | FK → Route | Shipment route |
| `status` | CharField(20) | PENDING, IN_TRANSIT, CUSTOMS, DELIVERED, DELAYED |
| `dispatch_status` | CharField(20) | UNASSIGNED, OFFERED, ACCEPTED, DISPATCHED |
| `carrier` | FK → Carrier | Assigned carrier (nullable) |
| `carrier_name` | CharField(100) | Denormalized carrier name |
| `assigned_truck` | FK → Truck | Assigned vehicle (nullable) |
| `assigned_driver` | FK → Driver | Assigned driver (nullable) |
| `weight_kg` | FloatField | Cargo weight in kg |
| `scheduled_departure` | DateTimeField | Planned departure |
| `scheduled_arrival` | DateTimeField | Planned arrival |
| `actual_departure` | DateTimeField | Actual departure (nullable) |
| `actual_arrival` | DateTimeField | Actual arrival (nullable) |
| `client` | FK → CustomUser | Shipment owner (nullable) |
| `delay_risk_score` | FloatField | ML prediction (0.0–1.0) |

**Indexes**: `tracking_number`, `status`, `dispatch_status`

### Document
Shipment-linked document with OCR extraction support.

| Field | Type | Description |
|---|---|---|
| `shipment` | FK → Shipment | Parent shipment |
| `file` | FileField | Uploaded file (shipment_docs/YYYY/MM/) |
| `doc_type` | CharField(20) | BOL, CUSTOMS, PACKING, INSURANCE, OTHER |
| `filename` | CharField(255) | Original filename |
| `uploaded_by` | FK → CustomUser | Uploader |

### ComplianceDoc
Compliance documents for cross-border shipments.

| Field | Type | Description |
|---|---|---|
| `shipment` | FK → Shipment | Parent shipment |
| `doc_type` | CharField(20) | CERTIFICATE, PERMIT, DECLARATION, INVOICE, MANIFEST, PHYTOSANITARY, INSURANCE, OTHER |
| `reference` | CharField(200) | Document reference number |
| `issued_by` | CharField(200) | Issuing authority |
| `issued_date` | DateField | Issue date |
| `expiry_date` | DateField | Expiry date |
| `is_required` | BooleanField | Required for shipment |
| `status` | CharField(10) | VALID, EXPIRED, EXPIRING, MISSING, PENDING |

### DocumentExtraction
OCR extraction result for a document.

| Field | Type | Description |
|---|---|---|
| `document` | OneToOne → Document | Source document |
| `doc_type` | CharField(20) | Classified document type |
| `type_confidence` | FloatField | Classification confidence (0.0–1.0) |
| `ocr_confidence` | FloatField | OCR text confidence (0–100) |
| `raw_text` | TextField | Extracted raw text |
| `extracted_fields` | JSONField | Structured extracted data |
| `suggested_review` | BooleanField | Manual review recommended |
| `processing_time_ms` | FloatField | Processing duration |
| `word_count` | IntegerField | Extracted word count |
| `page_count` | IntegerField | Document page count |

---

## tracking — Event Models

### TrackingEvent
Immutable tracking event log for shipments.

| Field | Type | Description |
|---|---|---|
| `shipment` | FK → Shipment | Parent shipment |
| `event_type` | CharField(20) | DEPARTURE, CHECKPOINT, CUSTOMS_ENTRY, CUSTOMS_CLEAR, ARRIVAL, DELAY, NOTE |
| `location` | CharField(200) | Human-readable location |
| `timestamp` | DateTimeField | Event timestamp |
| `notes` | TextField | Optional notes |
| `recorded_by` | FK → CustomUser | User who logged the event |

---

## alerts — Alert Models

### Alert
ML-triggered delay alerts with severity pipeline.

| Field | Type | Description |
|---|---|---|
| `shipment` | FK → Shipment | Affected shipment |
| `message` | TextField | Alert message |
| `risk_score` | FloatField | Delay probability (0.0–1.0) |
| `severity` | CharField(10) | CRITICAL (≥0.85), HIGH (≥0.70), MEDIUM (≥0.50), LOW (<0.50) |
| `sent_at` | DateTimeField | Alert creation time |
| `acknowledged` | BooleanField | Acknowledgment status |
| `acknowledged_by` | FK → CustomUser | Acknowledging user |

---

## fleet — Fleet Management

### Truck
Vehicle registry for the fleet.

| Field | Type | Description |
|---|---|---|
| `registration_number` | CharField | License plate |
| `make` | CharField | Vehicle manufacturer |
| `model` | CharField | Vehicle model |
| `year` | IntegerField | Manufacturing year |
| `capacity_kg` | FloatField | Load capacity |
| `status` | CharField | AVAILABLE, IN_TRANSIT, MAINTENANCE, RETIRED |
| `organization` | FK → Organization | Owning organization |

### Driver
Driver registry with performance tracking.

| Field | Type | Description |
|---|---|---|
| `driver_id` | CharField | Unique ID (DRV-XXXX) |
| `user` | FK → CustomUser | Linked user account |
| `first_name` / `last_name` | CharField | Driver name |
| `phone` / `email` | CharField | Contact info |
| `license_number` | CharField | Driving license |
| `license_class` | CharField | License class (C, CE, etc.) |
| `license_expiry` | DateField | License expiration |
| `certifications` | JSONField | Additional certifications |
| `status` | CharField | AVAILABLE, ON_TRIP, OFF_DUTY, SUSPENDED |
| `rating` | FloatField | Driver rating (0–5) |
| `on_time_rate` | FloatField | On-time delivery percentage |
| `total_jobs` | IntegerField | Lifetime job count |
| `total_km` | FloatField | Lifetime kilometers |
| `earnings_mtd` | DecimalField | Month-to-date earnings |

---

## carriers — Carrier Management

### Carrier
Carrier company profile.

| Field | Type | Description |
|---|---|---|
| `code` | CharField | Unique code (CAR-XXXXXXXX) |
| `name` | CharField | Company name |
| `status` | CharField | ACTIVE, INACTIVE, SUSPENDED |
| `organization` | FK → Organization | Linked organization |

### RateCard
Per-carrier, per-corridor freight rates.

| Field | Type | Description |
|---|---|---|
| `carrier` | FK → Carrier | Carrier |
| `origin` / `destination` | CharField | Route endpoints |
| `vehicle_type` | CharField | Vehicle type |
| `per_km` | DecimalField | Rate per km |
| `per_kg` | DecimalField | Rate per kg |
| `min_charge` | DecimalField | Minimum charge |
| `status` | CharField | ACTIVE, INACTIVE |

---

## payments — Financial Models

### Invoice
Freight invoice with tax calculation.

| Field | Type | Description |
|---|---|---|
| `invoice_number` | CharField | Auto-generated number |
| `shipment` | FK → Shipment | Associated shipment |
| `amount_kes` | DecimalField | Amount in KES |
| `amount_usd` | DecimalField | Amount in USD |
| `currency` | CharField | Billing currency |
| `status` | CharField | DRAFT, SENT, PAID, OVERDUE, CANCELLED |
| `created_by` | FK → CustomUser | Invoice creator |
| `paid_at` | DateTimeField | Payment timestamp |

### Payment
Payment transaction record.

| Field | Type | Description |
|---|---|---|
| `invoice` | FK → Invoice | Associated invoice |
| `provider` | CharField | Payment gateway (mpesa, stripe, flutterwave, etc.) |
| `amount` | DecimalField | Transaction amount |
| `currency` | CharField | Transaction currency |
| `status` | CharField | PENDING, SUCCEEDED, FAILED |
| `external_ref` | CharField | Gateway reference |

---

## marketplace — Freight Marketplace

### FreightListing
Freight shipment listing for marketplace.

| Field | Type | Description |
|---|---|---|
| `title` | CharField | Listing title |
| `description` | TextField | Detailed description |
| `origin` / `destination` | CharField | Route endpoints |
| `weight_kg` | FloatField | Cargo weight |
| `pickup_date` | DateTimeField | Required pickup |
| `delivery_date` | DateTimeField | Required delivery |
| `status` | CharField | OPEN, IN_PROGRESS, AWARDED, CLOSED |
| `listed_by` | FK → CustomUser | Listing creator |

### Bid
Carrier bid on a freight listing.

| Field | Type | Description |
|---|---|---|
| `listing` | FK → FreightListing | Freight listing |
| `carrier` | FK → Carrier | Bidding carrier |
| `amount` | DecimalField | Bid amount |
| `proposed_pickup` | DateTimeField | Proposed pickup date |
| `proposed_delivery` | DateTimeField | Proposed delivery date |
| `vehicle_type` | CharField | Proposed vehicle |
| `status` | CharField | PENDING, ACCEPTED, REJECTED |

---

## chats — Messaging Models

### Conversation
Chat conversation between users.

| Field | Type | Description |
|---|---|---|
| `participants` | M2M → CustomUser | Conversation participants |
| `created_at` | DateTimeField | Creation timestamp |

### Message
Individual chat message.

| Field | Type | Description |
|---|---|---|
| `conversation` | FK → Conversation | Parent conversation |
| `sender` | FK → CustomUser | Message sender |
| `content` | TextField | Message content |
| `created_at` | DateTimeField | Send timestamp |

---

## pod — Proof of Delivery

### ProofOfDelivery
Digital proof of delivery with signature and photo capture.

| Field | Type | Description |
|---|---|---|
| `shipment` | FK → Shipment | Delivered shipment |
| `signature` | ImageField | Recipient signature |
| `photo` | ImageField | Delivery photo |
| `recipient_name` | CharField | Receiving party |
| `recipient_id` | CharField | ID verification |
| `latitude` / `longitude` | FloatField | GPS coordinates at delivery |
| `notes` | TextField | Delivery notes |
| `captured_by` | FK → CustomUser | Person capturing POD |
| `captured_at` | DateTimeField | Capture timestamp |

---

## coldchain — Temperature Monitoring

### ColdChainShipment
Temperature-controlled shipment with compliance requirements.

| Field | Type | Description |
|---|---|---|
| `shipment` | OneToOne → Shipment | Parent shipment |
| `product_type` | CharField | PHARMA_REFRIGERATED, VACCINE, BLOOD_WHOLE, MEAT_CHILLED, DAIRY, FLOWERS, etc. |
| `min_temp_c` / `max_temp_c` | FloatField | Acceptable temperature range |
| `logging_interval_minutes` | IntegerField | Required logging frequency |
| `gdp_compliant` | BooleanField | GDP compliance status |
| `mkt_c` | FloatField | Mean Kinetic Temperature |

### TemperatureReading
Individual temperature data point.

| Field | Type | Description |
|---|---|---|
| `coldchain_shipment` | FK → ColdChainShipment | Parent shipment |
| `temperature_c` | FloatField | Recorded temperature |
| `sensor_id` | CharField | IoT sensor identifier |
| `timestamp` | DateTimeField | Reading timestamp |
| `is_excursion` | BooleanField | Outside acceptable range |

### TemperatureExcursion
Temperature violation event.

| Field | Type | Description |
|---|---|---|
| `coldchain_shipment` | FK → ColdChainShipment | Affected shipment |
| `severity` | CharField | WARNING, BREACH, CRITICAL, SPOILAGE_ALERT |
| `excursion_start` | DateTimeField | Start of excursion |
| `excursion_end` | DateTimeField | End of excursion (nullable) |
| `max_deviation_c` | FloatField | Maximum temperature deviation |
| `resolved_by` | FK → CustomUser | Resolving user |

### ColdChainSLA
Service level agreement for cold chain shipments.

| Field | Type | Description |
|---|---|---|
| `coldchain_shipment` | FK → ColdChainShipment | Shipment |
| `max_excursion_minutes` | IntegerField | Maximum allowed excursion |
| `max_excursion_count` | IntegerField | Maximum allowed excursions |
| `breached` | BooleanField | SLA breached |

---

## demurrage — Port Charges

### DemurrageCharge
Daily demurrage/detention charge record.

| Field | Type | Description |
|---|---|---|
| `container_number` | CharField | Container identifier |
| `port_code` | CharField(10) | KEMBA, TZDAR, KENBO, UGKAM, RWKGL |
| `container_type` | CharField(20) | 20FT_DRY, 40FT_DRY, 20FT_REEFER, 40FT_REEFER |
| `charge_type` | CharField(20) | DEMURRAGE, DETENTION, STORAGE |
| `arrival_date` | DateField | Container arrival date |
| `return_date` | DateField | Container return date |
| `free_days` | IntegerField | Free days allowed |
| `days_over` | IntegerField | Days beyond free period |
| `total_charge_usd` | DecimalField | Total charges |
| `responsibility` | CharField(20) | CONSIGNEE, CARRIER, CUSTOMS |
