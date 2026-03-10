"""
Geocoding proxy — backend/api/routes/geocode_route.py

WHY THIS EXISTS:
  Nominatim (OpenStreetMap) requires a real User-Agent header identifying your app.
  Browsers always override the User-Agent header for security reasons, so we cannot
  call Nominatim directly from frontend JavaScript.
  This endpoint is a thin proxy: frontend calls /geocode → backend calls Nominatim
  with the correct User-Agent → returns { lat, lon }.

USAGE:
  GET /geocode?name=Jasdan&state=Gujarat
  Returns: { "lat": 22.04, "lon": 71.20 }  or  { "lat": null, "lon": null }

CACHING:
  Results are cached in-memory (per server process).
  Same mandi name = only 1 Nominatim call ever, regardless of how many users ask.
"""

import httpx
from fastapi import APIRouter, Query
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/geocode", tags=["geocode"])

# In-memory cache: "Jasdan|Gujarat" → (22.04, 71.20)
# Persists for the lifetime of the server process (typically hours/days)
_geocode_cache: dict[str, Optional[tuple[float, float]]] = {}

# Nominatim usage policy: identify your app clearly
NOMINATIM_UA = "KrishiAI/1.0 (Indian farming assistant; contact: your@email.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@router.get("")
async def geocode_mandi(
    name: str = Query(..., description="Mandi name, e.g. 'Jasdan' or 'Jasdan(Vichhiya) APMC'"),
    state: str = Query(..., description="Indian state name, e.g. 'Gujarat'"),
):
    """
    Resolve a mandi name to lat/lon using OpenStreetMap Nominatim.
    Returns { lat, lon } on success, or { lat: null, lon: null } if not found.
    """
    # Clean the name before searching
    clean_name = (
        name
        .replace("APMC", "").replace("apmc", "")
        .replace("Mandi", "").replace("mandi", "")
        .replace("Market", "").replace("market", "")
        # Remove parenthetical variants: (Vichhiya), (Medinipur E), etc.
        .split("(")[0]
        .strip()
    )

    cache_key = f"{clean_name}|{state}"

    # Return cached result immediately (no Nominatim call needed)
    if cache_key in _geocode_cache:
        cached = _geocode_cache[cache_key]
        if cached:
            return {"lat": cached[0], "lon": cached[1], "source": "cache"}
        return {"lat": None, "lon": None, "source": "cache-miss"}

    query = f"{clean_name}, {state}, India"
    logger.info(f"[Geocode] Querying Nominatim: '{query}'")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "in",
                },
                headers={
                    # This is the critical header — set correctly from the server
                    "User-Agent": NOMINATIM_UA,
                    "Accept-Language": "en",
                },
            )

        if response.status_code != 200:
            logger.warning(f"[Geocode] Nominatim returned {response.status_code}")
            _geocode_cache[cache_key] = None
            return {"lat": None, "lon": None, "source": "error"}

        results = response.json()

        if results:
            lat = float(results[0]["lat"])
            lon = float(results[0]["lon"])
            logger.info(f"[Geocode] ✅ '{clean_name}' → lat={lat:.4f}, lon={lon:.4f}")
            _geocode_cache[cache_key] = (lat, lon)
            return {"lat": lat, "lon": lon, "source": "nominatim"}

        logger.info(f"[Geocode] ❌ No result for '{query}'")
        _geocode_cache[cache_key] = None
        return {"lat": None, "lon": None, "source": "not-found"}

    except httpx.TimeoutException:
        logger.warning(f"[Geocode] Timeout for '{query}'")
        _geocode_cache[cache_key] = None
        return {"lat": None, "lon": None, "source": "timeout"}

    except Exception as e:
        logger.error(f"[Geocode] Error for '{query}': {e}")
        _geocode_cache[cache_key] = None
        return {"lat": None, "lon": None, "source": "error"}
