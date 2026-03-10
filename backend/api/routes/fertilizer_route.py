from fastapi import APIRouter, HTTPException
from api.schemas import SoilGapRequest
from ml.inference.crop_inference import get_soil_gap_analysis

router = APIRouter(prefix="/soil", tags=["soil"])


@router.post("/gap-analysis")
def soil_gap_analysis_endpoint(request: SoilGapRequest):
    try:
        soil_data = {
            "N": request.N,
            "P": request.P,
            "K": request.K,
            "ph": request.ph,
        }
        result = get_soil_gap_analysis(soil_data, request.desired_crop)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
