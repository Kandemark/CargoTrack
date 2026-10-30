#!/usr/bin/env python3
"""
Record the API's answers for one demo user into the mobile app's offline
data file, so a demo build works with no server (EXPO_PUBLIC_DEMO=1).

Run against the dev stack after `scripts/devstack.sh start`:
    python3 scripts/capture-demo-data.py
"""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = 'http://localhost:8000'
USER, PASSWORD = 'amina', 'cargotrack-demo'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'frontends/mobile/assets/demo/fixtures.json'

# Paths the demo user may not be allowed to read; the app shows an "administrators only" state.
OPTIONAL = {'/api/v1/audit/', '/api/v1/integrations/', '/api/v1/accounts/users/'}

LISTS = [
    '/api/v1/accounts/me/', '/api/v1/accounts/notification-prefs/',
    '/api/v1/alerts/?all=1', '/api/v1/dashboard/stats/',
    '/api/v1/analytics/', '/api/v1/analytics/bid-analytics/', '/api/v1/analytics/corridors/',
    '/api/v1/analytics/driver-leaderboard/', '/api/v1/analytics/performance/', '/api/v1/analytics/profit/',
    '/api/v1/analytics/routes/', '/api/v1/audit/', '/api/v1/carbon/', '/api/v1/carriers/',
    '/api/v1/chat/conversations/', '/api/v1/coldchain/coldchain/', '/api/v1/compliance/',
    '/api/v1/fleet/drivers/', '/api/v1/fleet/stats/', '/api/v1/fleet/trucks/', '/api/v1/integrations/',
    '/api/v1/invoices/', '/api/v1/marketplace/listings/', '/api/v1/marketplace/my-bids/',
    '/api/v1/marketplace/my-listings/', '/api/v1/notifications/', '/api/v1/pod/pod/', '/api/v1/rate-cards/',
    '/api/v1/shipments/?page_size=100', '/api/v1/sla/', '/api/v1/accounts/users/',
]


def call(path, token=None, body=None):
    """GET (or POST with body) as JSON. Paced and retried, since the API allows 100 requests a minute."""
    for _ in range(4):
        req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
                                     headers={'Content-Type': 'application/json'})
        if token:
            req.add_header('Authorization', f'Bearer {token}')
        try:
            time.sleep(0.7)
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            if err.code != 429:
                return None
            time.sleep(int(err.headers.get('Retry-After') or 30) + 1)
        except Exception:
            return None
    return None


def items(data):
    return data if isinstance(data, list) else (data or {}).get('results', [])


def main():
    token = call('/api/auth/token/', body={'username': USER, 'password': PASSWORD})['access']
    responses = {}

    def grab(path):
        data = call(path, token)
        if data is not None:
            responses[path] = data
        return data

    for path in LISTS:
        grab(path)
    for s in items(responses.get('/api/v1/shipments/?page_size=100')):
        for suffix in ('', 'tracking-events/', 'documents/', 'predict/'):
            grab(f"/api/v1/shipments/{s['id']}/{suffix}")
    for c in items(responses.get('/api/v1/chat/conversations/')):
        grab(f"/api/v1/chat/conversations/{c['id']}/")
    for inv in items(responses.get('/api/v1/invoices/')):
        grab(f"/api/v1/invoices/{inv['id']}/")

    missing = [p for p in LISTS if p not in responses and p not in OPTIONAL]
    if missing:
        sys.exit(f'Not saved: no answer for {", ".join(missing)}. Is the dev stack running?')

    OUT.write_text(json.dumps({
        'capturedAt': datetime.now(timezone.utc).isoformat(),
        'responses': responses,
    }, separators=(',', ':')))
    print(f'{len(responses)} responses, {OUT.stat().st_size // 1024} KB -> {OUT}')


if __name__ == '__main__':
    main()
