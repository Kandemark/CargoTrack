# CargoTrack Features

## Platform Capabilities

### 1. OCR Document Extraction Pipeline

**Location**: `services/api/shipments/ocr/`

Automated document processing for East African logistics paperwork:
- **8 document types classified**: Bill of Lading, Customs Declaration, Commercial Invoice, CMR Consignment Note, Scale Ticket (Weighbridge), Packing List, Insurance Certificate, Phytosanitary Certificate
- **OCR Engine**: Tesseract with EAC-specific word lists (ports, corridors, shipping lines, currencies)
- **Preprocessing**: Grayscale → Adaptive Threshold → Deskew → Denoise; PDF rasterization via PyMuPDF
- **Field Extraction**: Regex-based structured extraction per document type (B/L number, vessel name, container numbers, HS codes, customs values, invoice totals, truck axle weights)
- **Confidence Scoring**: Type classification confidence + OCR text confidence + review suggestion flag

**API**: `POST /api/v1/documents/extract/` (multipart upload), `GET/DELETE /api/v1/documents/<id>/extraction/`

---

### 2. Customs System Integration (EAC)

**Location**: `services/edi-integration/` (Apache Camel), `services/api/shipments/customs.py` (Django)

Integration with all three major East African customs systems:

| System | Country | Protocol | Transport |
|---|---|---|---|
| **TradeNet** (KenTrade) | Kenya | SOAP XML | HTTPS + mTLS |
| **ASYCUDA World** (UNCTAD) | Uganda, Rwanda, Burundi, South Sudan, DRC | EDIFACT CUSCAR/CUSDEC | SFTP + AS2 |
| **TANCIS** (TRA) | Tanzania | XML | REST + OAuth2 |

**Operations supported**:
- Submit import/export/transit customs declaration
- Query declaration assessment status
- Receive customs clearance notifications
- Look up HS code tariff rates (EAC CET)
- Cargo manifest submission (CUSCAR)
- Border crossing system auto-detection

**API**: `POST /api/v1/customs/declare/`, `GET /api/v1/customs/status/`, `GET /api/v1/customs/tariff/`, `GET /api/v1/customs/borders/`

**11 border crossings mapped**: Busia, Malaba, Namanga, Taveta, Holili, Mutukula, Rusumo, Tunduma, Gatuna, Katuna, Akanyaru

---

### 3. SMS & USSD Gateway

**Location**: `services/notification/` (Go)

Multi-channel notification for drivers and logistics staff:

- **Africa's Talking integration**: Bulk SMS, premium SMS, delivery reports
- **USSD self-service portal** (*384#): Drivers check assigned shipments, update delivery status, report delays, request roadside assistance, check earnings — all from feature phones
- **Voice calls**: Text-to-speech emergency alerts via Africa's Talking Voice API
- **Airtime top-up**: Driver incentive payments
- **18 SMS templates**: Shipment lifecycle (assigned, departed, arrived, delayed), border crossing alerts, payment notifications, fleet alerts (fuel low, maintenance due, geofence breach), cold chain excursions, marketplace bid results

**USSD Menu Tree**:
```
*384# → CargoTrack Driver Portal
  1. My Shipments → Pending / In Transit / Delivered
  2. Update Status → Departure / Arrival / Border Check-in / Report Delay
  3. Request Assistance → Breakdown / Security / Medical
  4. My Account → Earnings / Profile
```

---

### 4. Real-Time ETA Engine

**Location**: `services/api/shipments/eta_engine.py`

Kalman filter-based ETA prediction fusing GPS telemetry with route data:

- **4-state Kalman filter**: [lat, lon, speed, heading] with covariance tracking
- **Route decomposition**: Distance remaining calculated along waypoint segments
- **Speed adjustments**: Road type (highway 80 km/h, paved 60, gravel 40, border zone 20, urban 30), weather factor (clear 1.0×, heavy rain 0.65×, storm 0.40×)
- **Border wait times**: Per-border estimates based on time of day congestion (light/normal/heavy)
- **Rest breaks**: Mandatory 30-minute breaks every 4.5 driving hours
- **Confidence intervals**: Optimistic (−20% travel time), pessimistic (+20%)

**API**: `GET /api/v1/eta/`, `POST /api/v1/eta/batch/`

---

### 5. Multi-Currency Finance Module

**Location**: `services/api/finance/`

EAC-specific financial calculations covering 5 currencies:

| Country | Currency | VAT | Withholding Tax | Fuel Surcharge |
|---|---|---|---|---|
| Kenya | KES | 16% | 5% | Yes |
| Tanzania | TZS | 18% | 5% | Yes |
| Uganda | UGX | 18% | 6% | Yes |
| Rwanda | RWF | 18% | 5% | Yes |
| Burundi | BIF | 18% | 5% | No |

- **Currency conversion**: Cross-rate triangulation via USD for all EAC + EUR/GBP
- **Invoice calculation**: Subtotal → VAT → WHT → Fuel surcharge → Total with conversions
- **Tax summaries**: Per-country rate lookup
- **M-Pesa Paybill references**: Included in payment notification templates

**API**: `GET /api/v1/finance/convert/`, `GET /api/v1/finance/taxes/`, `POST /api/v1/finance/calculate/`

---

### 6. Contract & Rate Management

**Location**: `services/api/contracts/`

Freight rate cards, contract pricing, and spot market reconciliation:

- **Rate cards**: Per-carrier, per-corridor pricing with vehicle type rates
- **Tiered pricing**: Volume-based discounts (e.g., 5% off at 10,000+ kg/month)
- **Rate types**: Per kg, per ton, per km, per trip (flat), per container, per CBM
- **Contract vs spot comparison**: Side-by-side cost analysis for 9 EAC corridors
- **Utilization reconciliation**: Actual shipments vs committed volumes with penalty calculation

**API**: `GET /api/v1/rates/`, `GET /api/v1/rates/compare/`

**9 corridors with rates**:
- Mombasa–Nairobi, Mombasa–Kampala, Mombasa–Kigali
- Nairobi–Kampala, Nairobi–Kigali, Nairobi–Dar es Salaam
- Dar es Salaam–Kigali, Kampala–Kigali

---

### 7. Cold Chain Compliance Suite

**Location**: `services/api/coldchain/`

GDP (Good Distribution Practice) and GSP (Good Storage Practice) compliance:

- **Product-specific temperature ranges**: Pharma (2-8°C refrigerated, -80°C ultra-cold), Vaccines (2-8°C, -80°C mRNA), Blood (1-6°C whole, -30°C plasma), Meat/Fish chilled, Dairy, Flowers
- **Mean Kinetic Temperature (MKT)**: Calculated per USP <1079> with ΔH=83.144 kJ/mol
- **GDP compliance reports**: Logging interval compliance (>=90%), excursion documentation, corrective action recommendations
- **Excursion management**: Auto-resolve, escalation (WARNING→BREACH→CRITICAL→SPOILAGE_ALERT), SLA breach tracking
- **Alerts**: Signal-based alert creation on excursion detection with severity mapping
- **Certificates**: Digital compliance certificates at delivery

**Models**: ColdChainShipment, TemperatureReading, TemperatureExcursion, ColdChainSLA, ColdChainCertificate

---

### 8. Demurrage & Detention Calculator

**Location**: `services/api/demurrage/`

Port container charges with tiered tariff escalation:

- **5 EAC ports configured**: Mombasa (KEMBA), Dar es Salaam (TZDAR), Nairobi ICD (KENBO), Kampala ICD (UGKAM), Kigali ICD (RWKGL)
- **Tiered tariff escalation**: Rates increase after day 5, day 10, day 15 (e.g., Mombasa 20ft: $20/day days 1-5, $40/day days 6-10, $60/day days 11-15, $100/day days 16+)
- **Container types**: 20ft dry, 40ft dry, 20ft reefer, 40ft reefer
- **Charge types**: Demurrage (terminal), Detention (consignee), Storage (warehouse)
- **Responsibility attribution**: Auto-determines whether consignee, carrier, or customs is responsible based on delay duration
- **Daily accrual audit trail**: Per-container, per-day tracking

**API**: `GET /api/v1/demurrage/`, `GET /api/v1/demurrage/port/`
