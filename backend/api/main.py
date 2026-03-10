from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes.crop import router as crop_router
from api.routes.pest import router as pest_router
from api.routes.yield_route import router as yield_router
from api.routes.fertilizer_route import router as fertilizer_router
from api.routes.geocode_route import router as geocode_router

app = FastAPI(title="Krishi AI Backend", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crop_router)
app.include_router(pest_router)
app.include_router(yield_router)
app.include_router(fertilizer_router)
app.include_router(geocode_router)


@app.get("/")
def root():
    return {"status": "ok", "service": "Krishi AI Backend v1.3"}


@app.get("/health")
def health():
    return {"status": "healthy"}
