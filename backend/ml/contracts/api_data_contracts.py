"""
API Data Contracts — Krishi AI
================================
Defines all input/output schemas for each ML module.
This is the integration specification for the FastAPI backend.
"""

# =============================================================================
# MODULE 1: CROP RECOMMENDATION
# =============================================================================

CROP_RECOMMENDATION_INPUT = {
    "description": "Soil test parameters for crop recommendation",
    "required_fields": {
        "N":           {"type": "float", "range": [0, 300],   "unit": "kg/ha", "example": 90},
        "P":           {"type": "float", "range": [0, 300],   "unit": "kg/ha", "example": 42},
        "K":           {"type": "float", "range": [0, 300],   "unit": "kg/ha", "example": 43},
        "temperature": {"type": "float", "range": [-5, 55],   "unit": "°C",    "example": 20.9},
        "humidity":    {"type": "float", "range": [0, 100],   "unit": "%",     "example": 82.0},
        "ph":          {"type": "float", "range": [0, 14],    "unit": "pH",    "example": 6.5},
        "rainfall":    {"type": "float", "range": [0, 10000], "unit": "mm",    "example": 202.9},
    },
    "optional_fields": {
        "location":    {"type": "string", "example": "Maharashtra"},
        "top_n":       {"type": "int",    "default": 3, "range": [1, 10]},
        "language":    {"type": "string", "enum": ["en", "hi", "hinglish"], "default": "en"},
    }
}

CROP_RECOMMENDATION_OUTPUT = {
    "recommendations": [
        {
            "rank":            1,
            "crop":            "rice",
            "confidence":      0.9500,
            "confidence_pct":  "95.0%",
            "risk_level":      "Low",     # Low | Medium | High
            "yield_range":     {"min_qt": 25, "max_qt": 60, "unit": "quintals/acre"},
            "description":     "Paddy/Rice prefers waterlogged clay soils...",
            "suitable_soils":  ["Clay", "Clay loam"],
        }
    ],
    "input_summary": {"N": 90, "P": 42, "K": 43, "temperature": 20.9, "humidity": 82.0, "ph": 6.5, "rainfall": 202.9},
    "model_version": "v1.0_random_forest",
}

# =============================================================================
# MODULE 2: SOIL GAP ANALYSIS
# =============================================================================

SOIL_GAP_INPUT = {
    "description": "Current soil data + desired crop for gap analysis",
    "required_fields": {
        "N":            {"type": "float", "range": [0, 300],  "unit": "kg/ha"},
        "P":            {"type": "float", "range": [0, 300],  "unit": "kg/ha"},
        "K":            {"type": "float", "range": [0, 300],  "unit": "kg/ha"},
        "ph":           {"type": "float", "range": [0, 14]},
        "desired_crop": {"type": "string", "example": "wheat",
                         "options": ["rice", "wheat", "maize", "cotton", "banana", "+18 more"]},
    },
    "optional_fields": {
        "language": {"type": "string", "enum": ["en", "hi", "hinglish"], "default": "en"},
    }
}

SOIL_GAP_OUTPUT = {
    "desired_crop": "wheat",
    "nutrient_gaps": [
        {"nutrient": "N", "current": 40, "required_min": 100, "required_max": 150,
         "deficit": 60, "status": "DEFICIENT", "severity": "High", "unit": "kg/ha"},
        {"nutrient": "P", "current": 60, "required_min": 50,  "required_max": 80,
         "status": "OPTIMAL"},
    ],
    "ph_analysis": {
        "current": 5.0, "required_min": 6.0, "required_max": 7.5, "status": "TOO_ACIDIC"
    },
    "fertilizer_plan": [
        {"nutrient": "Nitrogen (N)", "product": "Urea (46% N)",
         "quantity_kg_acre": 130.0, "application": "Split: 50% basal + ...",
         "alternative": "DAP"},
    ],
    "micronutrient_plan": ["Zinc Sulphate", "Boron (Borax)"],
    "pesticide_advisory": ["Propiconazole (rust)", "Chlorpyrifos (aphids)"],
    "correction_steps":   ["Step 1: Apply Agricultural Lime...", "Step 2: Apply Urea..."],
    "crop_description":   "Wheat thrives in cool, dry conditions...",
}

# =============================================================================
# MODULE 3: MARKET INTELLIGENCE
# =============================================================================

MARKET_PRICE_INPUT = {
    "endpoint": "GET /api/v1/market/prices",
    "query_params": {
        "crop":     {"type": "string", "required": True,  "example": "Rice"},
        "state":    {"type": "string", "required": False, "example": "Maharashtra"},
        "language": {"type": "string", "required": False, "default": "en"},
    }
}

MARKET_PRICE_OUTPUT = {
    "crop":   "Rice",
    "state":  "Maharashtra",
    "price_stats": {
        "avg_modal_price_per_quintal": 2100.50,
        "min_price_per_quintal":       1500.00,
        "max_price_per_quintal":       2800.00,
        "median_price_per_quintal":    2050.00,
    },
    "top_markets": [
        {"market": "Pune APMC", "district": "Pune", "state": "Maharashtra",
         "avg_price_per_quintal": 2150.00},
    ],
    "monthly_trend": [
        {"month": "2019-04", "avg_price": 2050.0},
    ],
}

MANDI_INPUT = {
    "endpoint": "GET /api/v1/market/mandis",
    "query_params": {
        "state":    {"type": "string", "required": True,  "example": "Maharashtra"},
        "district": {"type": "string", "required": False, "example": "Pune"},
        "crop":     {"type": "string", "required": False, "example": "Rice"},
    }
}

MANDI_OUTPUT = {
    "state":        "Maharashtra",
    "district":     "Pune",
    "total_mandis": 8,
    "mandis": [
        {"market_name": "Pune APMC",  "district": "Pune", "state": "Maharashtra",
         "commodities": ["Rice", "Wheat"],    "avg_price": 2150.0, "type": "APMC Mandi"},
    ],
}

# =============================================================================
# MODULE 4: MACHINERY RECOMMENDATION
# =============================================================================

MACHINERY_INPUT = {
    "endpoint": "POST /api/v1/machinery/recommend",
    "required_fields": {
        "crop":           {"type": "string", "example": "Rice"},
        "farm_size_acres":{"type": "float",  "range": [0.1, 10000], "example": 5.0},
        "soil_type":      {"type": "string", "enum": ["Sandy", "Loam", "Clay", "Black Cotton"]},
    },
    "optional_fields": {
        "state":    {"type": "string", "example": "Punjab"},
        "language": {"type": "string", "enum": ["en", "hi", "hinglish"], "default": "en"},
    }
}

MACHINERY_OUTPUT = {
    "crop":       "Rice",
    "farm_size":  5.0,
    "soil_type":  "Clay",
    "recommended_machinery": [
        {"name": "Paddy Transplanter",  "type": "Planting",   "rental_cost_day": 1500,
         "buy_cost_approx": 90000,   "priority": "High"},
        {"name": "Combined Harvester",  "type": "Harvesting",  "rental_cost_day": 3000,
         "buy_cost_approx": 1500000, "priority": "High"},
        {"name": "Drip Irrigation",     "type": "Irrigation",  "rental_cost_day": None,
         "buy_cost_approx": 25000,   "priority": "Medium"},
    ],
    "rental_services": [
        {"name": "Custom Hiring Centre", "distance_km": 5, "contact": "Available at district KVK"},
    ],
}

# =============================================================================
# MODULE 5: WEATHER & RISK
# =============================================================================

WEATHER_INPUT = {
    "endpoint": "GET /api/v1/weather/forecast",
    "query_params": {
        "latitude":  {"type": "float",  "required": True,  "example": 19.07},
        "longitude": {"type": "float",  "required": True,  "example": 72.87},
        "days":      {"type": "int",    "required": False, "default": 7, "max": 16},
    }
}

WEATHER_OUTPUT = {
    "location":   {"latitude": 19.07, "longitude": 72.87},
    "data_source":"Open-Meteo (free, no API key required)",
    "forecast": [
        {"date": "2026-03-04", "temp_max": 35.0, "temp_min": 22.0,
         "precipitation_mm": 5.0, "wind_speed": 12.0, "condition": "Partly Cloudy"},
    ],
    "risk_alerts": [
        {"type": "Heavy Rainfall", "level": "Medium",
         "recommendation": "Delay fertilizer application for 48 hours."},
    ],
}

PEST_RISK_INPUT = {
    "endpoint": "POST /api/v1/weather/pest-risk",
    "required_fields": {
        "insects_count": {"type": "float", "range": [0, 10000], "example": 300},
    },
    "optional_fields": {
        "crop_type":              {"type": "int", "enum": [0, 1, 2], "note": "0=Cereals,1=Pulses,2=Oilseeds"},
        "soil_type":              {"type": "int", "enum": [0, 1, 2], "note": "0=Sandy,1=Loam,2=Clay"},
        "pesticide_use_category": {"type": "int", "enum": [0, 1, 2], "note": "0=None,1=Organic,2=Chemical"},
        "number_doses_week":      {"type": "float", "default": 0},
        "number_weeks_used":      {"type": "float", "default": 0},
        "number_weeks_quit":      {"type": "float", "default": 0},
        "season":                 {"type": "int",   "enum": [1, 2, 3], "note": "1=Rabi,2=Kharif,3=Zaid"},
    }
}

PEST_RISK_OUTPUT = {
    "damage_class":  2,
    "damage_label":  "High Damage",
    "risk_level":    "High",
    "confidence":    0.8700,
    "confidence_pct":"87.0%",
    "urgency":       "IMMEDIATE",
    "preventive_advisory": ["Apply systemic pesticide...", "Consult local KVK..."],
    "model_version": "v1.0_random_forest",
}

# =============================================================================
# MODULE 6: YIELD & PROFIT ESTIMATION
# =============================================================================

YIELD_ESTIMATE_INPUT = {
    "endpoint": "POST /api/v1/yield/estimate",
    "required_fields": {
        "crop":   {"type": "string", "example": "Rice"},
        "region": {"type": "string", "enum": ["North", "South", "East", "West", "Central"]},
    },
    "optional_fields": {
        "soil_type":                {"type": "string", "example": "Clay"},
        "rainfall_mm":              {"type": "float",  "default": 500},
        "temperature_celsius":      {"type": "float",  "default": 25},
        "fertilizer_used":          {"type": "bool",   "default": True},
        "irrigation_used":          {"type": "bool",   "default": True},
        "weather_condition":        {"type": "string", "enum": ["Sunny","Cloudy","Rainy","Windy"], "default": "Sunny"},
        "days_to_harvest":          {"type": "int",    "range": [30, 365], "default": 120},
        "farm_size_acres":          {"type": "float",  "default": 1.0},
        "input_cost_per_acre":      {"type": "float",  "unit": "Rs/acre", "default": 10000},
        "market_price_per_quintal": {"type": "float",  "unit": "Rs/quintal", "default": 2000},
        "language":                 {"type": "string", "enum": ["en", "hi", "hinglish"]},
    }
}

YIELD_ESTIMATE_OUTPUT = {
    "yield_estimation": {
        "yield_per_hectare_tons":  8.527,
        "yield_per_acre_tons":     3.453,
        "total_yield_tons":        8.633,
        "total_yield_quintals":    86.33,
        "farm_size_acres":         2.5,
    },
    "profit_analysis": {
        "market_price_per_quintal": 2100,
        "input_cost_per_acre":      12000,
        "total_cost_rs":            30000.0,
        "total_revenue_rs":         181293.0,
        "gross_profit_rs":          151293.0,
        "profit_margin_pct":        83.46,
        "is_profitable":            True,
    },
    "breakeven_analysis": {
        "breakeven_yield_quintals": 14.29,
        "actual_vs_breakeven":      "ABOVE",
        "safety_margin_pct":        504.1,
    },
    "model_version": "v1.0_gradient_boosting",
}

# =============================================================================
# MODULE 7: CHAT ASSISTANT
# =============================================================================

CHAT_INPUT = {
    "endpoint": "POST /api/v1/chat/message",
    "fields": {
        "message":          {"type": "string", "required": True,
                             "example": "मेरी मिट्टी में N=60, P=40, K=30 है, कौन सी फसल उगाऊं?"},
        "language":         {"type": "string", "enum": ["en", "hi", "hinglish", "auto"],
                             "default": "auto"},
        "session_id":       {"type": "string", "required": False,
                             "description": "For context tracking across conversation"},
        "soil_context":     {"type": "object", "required": False,
                             "description": "Optional pre-loaded soil data for the session"},
    }
}

CHAT_OUTPUT = {
    "response":          "आपकी मिट्टी के लिए सबसे अच्छी फसल है: चावल (Rice) — 95% confidence",
    "detected_language": "hi",
    "intent":            "crop_recommendation",
    "data":              {"recommendations": [...]},
    "follow_up_prompts": [
        "मंडी की कीमत जानें (Market price देखें)",
        "मिट्टी सुधार योजना बनाएं",
    ],
    "session_id": "abc123",
}

# =============================================================================
# WEATHER API INTEGRATION PLAN (Free Tier)
# =============================================================================

WEATHER_API_INTEGRATION = {
    "provider":      "Open-Meteo (https://open-meteo.com/)",
    "cost":          "FREE — No API key required",
    "rate_limit":    "10,000 calls/day (generous free tier)",
    "endpoint":      "https://api.open-meteo.com/v1/forecast",
    "parameters":    {
        "latitude":     "float",
        "longitude":    "float",
        "daily":        ["temperature_2m_max", "temperature_2m_min",
                         "precipitation_sum", "windspeed_10m_max",
                         "weathercode"],
        "forecast_days": "1–16",
    },
    "caching":       "TTLCache — 1 hour TTL to avoid redundant calls",
    "retry":         "tenacity — 3 retries, exponential backoff",
    "fallback":      "Return last cached response if API fails",
}

GEOCODING_API_INTEGRATION = {
    "provider":  "Nominatim / OpenStreetMap (https://nominatim.openstreetmap.org/)",
    "cost":      "FREE — No API key required",
    "rate_limit":"1 request/second (must respect)",
    "endpoint":  "https://nominatim.openstreetmap.org/search",
    "usage":     "Convert farm address/village → latitude/longitude",
    "caching":   "Cache geocode results — TTL 24h (addresses don't change)",
    "headers":   {"User-Agent": "KrishiAI/1.0 (yourcontact@email.com)"},
}

MARKET_API_INTEGRATION = {
    "primary":   "Local CSV (marketcropdata.csv) — Pre-loaded at startup",
    "secondary": "Agmarknet (https://agmarknet.gov.in/) — Government of India",
    "cost":      "FREE — Government open data",
    "note":      "Agmarknet has publicly accessible price data. For MVP, CSV is sufficient.",
    "refresh":   "Manual CSV update periodically, or script to scrape Agmarknet.",
}

# =============================================================================
# PRINT CONTRACT SUMMARY
# =============================================================================

if __name__ == "__main__":
    import json

    print("="*70)
    print("  KRISHI AI — API DATA CONTRACTS SUMMARY")
    print("="*70)

    contracts = [
        ("1. Crop Recommendation", CROP_RECOMMENDATION_INPUT, CROP_RECOMMENDATION_OUTPUT),
        ("2. Soil Gap Analysis",   SOIL_GAP_INPUT,            SOIL_GAP_OUTPUT),
        ("3. Market Prices",       MARKET_PRICE_INPUT,        MARKET_PRICE_OUTPUT),
        ("4. Mandi Lookup",        MANDI_INPUT,               MANDI_OUTPUT),
        ("5. Machinery",           MACHINERY_INPUT,           MACHINERY_OUTPUT),
        ("6. Weather Forecast",    WEATHER_INPUT,             WEATHER_OUTPUT),
        ("7. Pest Risk",           PEST_RISK_INPUT,           PEST_RISK_OUTPUT),
        ("8. Yield Estimate",      YIELD_ESTIMATE_INPUT,      YIELD_ESTIMATE_OUTPUT),
        ("9. Chat Assistant",      CHAT_INPUT,                CHAT_OUTPUT),
    ]

    for name, input_schema, output_schema in contracts:
        print(f"\n📌 {name}")
        endpoint = input_schema.get("endpoint", "POST /api/v1/...")
        print(f"   Endpoint : {endpoint}")
        required = input_schema.get("required_fields", input_schema.get("query_params", {}))
        print(f"   Required : {list(required.keys())}")

    print("\n\n📡 FREE API INTEGRATIONS:")
    for api_name, info in [("Weather", WEATHER_API_INTEGRATION),
                            ("Geocoding", GEOCODING_API_INTEGRATION),
                            ("Market", MARKET_API_INTEGRATION)]:
        print(f"\n  {api_name}:")
        print(f"    Provider : {info['provider']}")
        print(f"    Cost     : {info['cost']}")

    print("\n✅ All contracts defined. Ready for FastAPI backend implementation.")
