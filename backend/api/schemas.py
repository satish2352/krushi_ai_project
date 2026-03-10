from typing import Optional
from pydantic import BaseModel


class CropRequest(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float
    top_n: Optional[int] = 3


class PestRequest(BaseModel):
    insects_count: float
    crop_type: Optional[int] = 1
    soil_type: Optional[int] = 1
    pesticide_use_category: Optional[int] = 1
    number_doses_week: Optional[float] = 0
    number_weeks_used: Optional[float] = 0
    number_weeks_quit: Optional[float] = 0
    season: Optional[int] = 2


class YieldRequest(BaseModel):
    rainfall_mm: float
    temperature_celsius: float
    days_to_harvest: float
    fertilizer_used: int
    irrigation_used: int
    region: str
    soil_type: str
    crop: str
    weather_condition: str
    farm_size_acres: Optional[float] = 1.0
    market_price_per_quintal: Optional[float] = None
    input_cost_per_acre: Optional[float] = None


class SoilGapRequest(BaseModel):
    N: float
    P: float
    K: float
    ph: float
    desired_crop: str
