from fastapi import APIRouter, HTTPException
from api.schemas import YieldRequest
from ml.inference.yield_inference import predict_yield

router = APIRouter(prefix="/predict", tags=["yield"])


@router.post("/yield")
def predict_yield_endpoint(request: YieldRequest):
    try:
        input_data = {
            "crop":                request.crop,
            "region":              request.region,
            "soil_type":           request.soil_type,
            "rainfall_mm":         request.rainfall_mm,
            "temperature_celsius": request.temperature_celsius,
            "fertilizer_used":     request.fertilizer_used,
            "irrigation_used":     request.irrigation_used,
            "weather_condition":   request.weather_condition,
            "days_to_harvest":     request.days_to_harvest,
            "farm_size_acres":     request.farm_size_acres or 1.0,
        }

        # Only add optional price fields if they are actually provided
        # (passing None causes float(None) crash in yield_inference.py)
        if request.market_price_per_quintal is not None:
            input_data["market_price_per_quintal"] = request.market_price_per_quintal

        if request.input_cost_per_acre is not None:
            input_data["input_cost_per_acre"] = request.input_cost_per_acre

        result = predict_yield(input_data)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
