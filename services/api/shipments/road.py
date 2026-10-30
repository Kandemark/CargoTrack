"""
Road geometry for routes: the path a truck actually drives, not a straight
line between two cities.

Each Route stores its path once (Route.geometry, [[lng, lat], ...]); maps
draw that instead of asking a routing service on every screen. Paths come
from an OSRM server (settings.OSRM_URL). The public demo server is fine for
development only; production should run its own OSRM with an East Africa
extract.
"""
import json
import logging
import math
import urllib.request

from django.conf import settings

log = logging.getLogger(__name__)

# Town centres and border posts on the region's freight corridors, [lng, lat].
PLACES = {
    'mombasa': (39.6682, -4.0435), 'nairobi': (36.8219, -1.2921), 'kampala': (32.5825, 0.3476),
    'kigali': (30.0619, -1.9441), 'dar es salaam': (39.2083, -6.7924), 'kisumu': (34.7617, -0.1022),
    'eldoret': (35.2698, 0.5143), 'nakuru': (36.0800, -0.3031), 'bujumbura': (29.3644, -3.3731),
    'juba': (31.5713, 4.8594), 'dodoma': (35.7395, -6.1731), 'arusha': (36.6830, -3.3869),
    'malaba': (34.2756, 0.6366), 'busia': (34.1115, 0.4608), 'namanga': (36.7833, -2.5500),
    'voi': (38.5561, -3.3961), 'mariakani': (39.4739, -3.8625), 'gatuna': (30.0167, -1.4333),
    'tanga': (39.0986, -5.0689), 'mwanza': (32.9000, -2.5167), 'goma': (29.2205, -1.6792),
    'lodwar': (35.5973, 3.1191), 'moyale': (39.0570, 3.5167), 'isiolo': (37.5822, 0.3546),
}

# Points closer than this to the simplified line are dropped (~50 m).
SIMPLIFY_DEGREES = 0.0005


def place(name: str):
    """Coordinates for a place name ("Nairobi ICD" → Nairobi), or None."""
    n = name.lower()
    for key, coords in PLACES.items():
        if key in n:
            return coords
    return None


def simplify(points, tolerance=SIMPLIFY_DEGREES):
    """Ramer-Douglas-Peucker: keep the bends, drop points on straight stretches."""
    if len(points) < 3:
        return points

    def dist(p, a, b):
        if a == b:
            return math.dist(p, a)
        (x, y), (x1, y1), (x2, y2) = p, a, b
        t = max(0, min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)))
        return math.dist(p, (x1 + t * (x2 - x1), y1 + t * (y2 - y1)))

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        best, idx = 0.0, None
        for i in range(lo + 1, hi):
            d = dist(points[i], points[lo], points[hi])
            if d > best:
                best, idx = d, i
        if idx is not None and best > tolerance:
            keep[idx] = True
            stack += [(lo, idx), (idx, hi)]
    return [p for p, k in zip(points, keep) if k]


def fetch_road(origin, destination):
    """The driving path between two [lng, lat] points from OSRM, simplified; None if unavailable."""
    url = (
        f"{settings.OSRM_URL.rstrip('/')}/route/v1/driving/"
        f"{origin[0]},{origin[1]};{destination[0]},{destination[1]}?overview=full&geometries=geojson"
    )
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'CargoTrack/1.0'})
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.load(res)
    except Exception as exc:  # network or server error: the map falls back to a straight line
        log.warning('OSRM request failed for %s -> %s: %s', origin, destination, exc)
        return None
    if data.get('code') != 'Ok' or not data.get('routes'):
        return None
    coords = [tuple(round(c, 5) for c in p) for p in data['routes'][0]['geometry']['coordinates']]
    return [list(p) for p in simplify(coords)]


def fill_route_geometry(route, force=False):
    """Store the road path on a route if it has none (or force). Returns True when stored."""
    if route.geometry and not force:
        return False
    a, b = place(route.origin), place(route.destination)
    if not a or not b:
        return False
    path = fetch_road(a, b)
    if not path:
        return False
    route.geometry = path
    route.save(update_fields=['geometry'])
    return True
