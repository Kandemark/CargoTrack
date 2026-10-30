"""Road paths: place lookup, simplification, and storing a path on a route."""
from unittest import mock

import pytest

from shipments import road


def test_place_matches_inside_longer_names():
    assert road.place('Nairobi ICD') == road.PLACES['nairobi']
    assert road.place('Atlantis') is None


def test_simplify_keeps_bends_and_drops_straight_points():
    line = [[0, 0], [1, 0.00001], [2, 0], [2, 1], [2, 2]]
    assert road.simplify(line, tolerance=0.001) == [[0, 0], [2, 0], [2, 2]]


@pytest.mark.django_db
def test_fill_route_geometry_stores_the_path_once():
    from shipments.models import Route

    route = Route.objects.create(origin='Mombasa', destination='Nairobi', distance_km=485, estimated_hours=10)
    path = [[39.66, -4.04], [38.55, -3.39], [36.82, -1.29]]
    with mock.patch.object(road, 'fetch_road', return_value=path) as fetch:
        assert road.fill_route_geometry(route) is True
        assert road.fill_route_geometry(route) is False
    fetch.assert_called_once()
    route.refresh_from_db()
    assert route.geometry == path
