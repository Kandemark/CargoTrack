# Weekly Progress Report — Week 1
**Group 10 | CIT 2228 | CargoTrack**
**Week Dates:** 23–29 March 2026
**Submitted by:** Mark Mbugu (Project Lead)

---

## Summary of Work Completed

- Project proposal (Deliverable A) written and submitted as PDF — all 14 sections including OOP class design, milestones, team roles, risk register, and evaluation plan.
- Pitch deck (Deliverable B) created (11 slides) and submitted as PDF — covers problem, solution, features, technical architecture, team, milestones, and the ask.
- GitHub repository created at https://github.com/Kandemark/CargoTrack and all group members added as collaborators.
- Full Django project scaffold pushed to `main` branch — 60 files across 6 Django apps: `accounts`, `shipments`, `tracking`, `predictions`, `alerts`, `dashboard`.
- All core OOP classes designed and implemented:
  - `CustomUser` (role-based access)
  - `Shipment`, `Route`, `Carrier` (encapsulation + composition)
  - `TrackingEvent` (inherits abstract `ShipmentEvent`)
  - `BasePredictor` (ABC), `DelayPredictor`, `FeatureEngineer`
  - `BaseAlertHandler` (ABC), `EmailAlertHandler`, `InAppAlertHandler`, `AlertManager`

## Evidence of Work

- GitHub commits: https://github.com/Kandemark/CargoTrack/commits/main
- Proposal PDF: submitted via LMS
- Pitch Deck PDF: submitted via LMS

## What is Working Now

- Django project structure fully scaffolded and importable.
- All model classes defined — `python manage.py migrate` runs without errors.
- Django admin registered for all models.
- REST API viewsets defined for Shipment and TrackingEvent.
- `DelayPredictor` can be instantiated and trained on synthetic data.

## Plan for Next Week (Week 2: 30 Mar–5 Apr)

- Run full `python manage.py migrate` and `createsuperuser`.
- Complete Shipment CRUD views and Django admin polish (Quinsley).
- Wire up all URL patterns and test navigation end-to-end.
- Build base HTML template and dashboard layout (Diamond).
- Write first pytest test cases (Japheth).
- Download DataCo dataset from Kaggle for Week 3 ML training (Jara).

## Challenges / Blockers

- Some group members are setting up GitHub accounts for the first time — resolved by sharing a setup guide.
- DataCo dataset access requires Kaggle account — team has been briefed.

## Attendance

All 8 members participated this week.
| Name | Contributed |
|------|------------|
| Mark Mbugu | yes |
| Quinsley Mchana | yes |
| Jara Emmanuel | yes |
| Diamond Kethi | yes |
| Victor Mburu | yes |
| Japheth Keith | yes |
| Grey Boston | yes |
| Andrew Maina | yes |
