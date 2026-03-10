from fastapi import APIRouter, HTTPException

# from backend.api.schemas import PestRequest
from api.schemas import PestRequest
# from ...pest_inference import predict_pest_risk
# from backend.ml.inference.pest_inference import predict_pest_risk
from ml.inference.pest_inference import predict_pest_risk


router = APIRouter(prefix="/predict", tags=["pest"])


@router.post("/pest")
def predict_pest_endpoint(request: PestRequest):
    try:
        data = request.dict()
        result = predict_pest_risk(data=data)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

