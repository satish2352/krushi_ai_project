from fastapi import APIRouter, HTTPException

# from backend.api.schemas import CropRequest
from api.schemas import CropRequest
# from ...crop_inference import predict_crop
# from backend.ml.inference.crop_inference import predict_crop
from ml.inference.crop_inference import predict_crop


router = APIRouter(prefix="/predict", tags=["crop"])


@router.post("/crop")
def predict_crop_endpoint(request: CropRequest):
    try:
        soil_data = {
            "N": request.N,
            "P": request.P,
            "K": request.K,
            "temperature": request.temperature,
            "humidity": request.humidity,
            "ph": request.ph,
            "rainfall": request.rainfall,
        }
        result = predict_crop(soil_data=soil_data, top_n=request.top_n or 3)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

