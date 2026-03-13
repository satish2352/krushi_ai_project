# 🌾 Krishi AI — Intelligent Farming Decision Support System

An AI-powered smart farming assistant that analyzes soil data and provides end-to-end recommendations for crop planning, soil improvement, market access, equipment management, and profit estimation.

\---

## 🚀 Features

|#|Module|Trigger Example|
|-|-|-|
|1|**AI Crop Recommendation**|"which crop should I grow here?"|
|2|**Soil Improvement Advisory**|"fertilizer for wheat?"|
|3|**Market Intelligence \& Selling**|"mandi price for cotton?"|
|4|**Farm Machinery Recommendation**|"buy sprayer near me"|
|5|**Weather \& Risk Alert**|Auto-fetched via GPS|
|6|**Yield \& Profit Dashboard**|"2 acres cotton, what profit?"|

\---

## 🛠️ Tech Stack

|Layer|Technology|
|-|-|
|Frontend|Next.js + React + TypeScript + Tailwind CSS|
|Backend|Python FastAPI (Uvicorn)|
|Primary AI|Gemini 2.5 Flash (Crop analysis + Soil PDF parsing)|
|Conversational AI|Groq LLaMA-3.3-70b (Hindi/English chat)|
|ML Fallback|Random Forest `.pkl` (90.18% accuracy, 38 crops)|
|Weather|OpenWeatherMap API|
|Market Prices|APMC Gov India API (data.gov.in)|
|Geocoding|Nominatim (OSM)|

\---

## 📁 Project Structure

```
Krishi\_AI\_Project/
├── backend/                  # Python FastAPI
│   ├── app.py                # Main FastAPI entry point
│   ├── crop\_inference.py     # Gemini → pkl → rule-based fallback
│   ├── fertilizer\_route.py   # Soil gap analysis
│   ├── yield\_inference.py    # Yield \& profit ML model
│   ├── soil\_crop\_profiles.json
│   ├── requirements.txt
│   └── .venv/
│
├── frontend/                 # Next.js App
│   └── src/
│       ├── services/         # api.ts, llm.ts, weather.ts, market.ts
│       ├── utils/            # keywordDetection.ts, router.ts
│       └── types/
│
├── Crop\_data.csv
├── crop\_yield.csv
├── marketcropdata.csv
└── plant\_disease\_precautions.csv
```

\---

## ⚙️ Prerequisites

* Python 3.10+
* Node.js 18+
* npm

\---

## 🔑 API Keys Required

Create a `.env` file inside the `backend/` folder:

```env
GEMINI\_API\_KEY=your\_gemini\_api\_key
```

Create a `.env.local` file inside the `frontend/` folder:

```env
NEXT\_PUBLIC\_GROQ\_API\_KEY=your\_groq\_api\_key
NEXT\_PUBLIC\_WEATHER\_API\_KEY=your\_openweathermap\_api\_key
NEXT\_PUBLIC\_APMC\_API\_KEY=your\_apmc\_api\_key
```

\---

## ▶️ How to Run

### 1\. Clone the Repository

```bash
git clone https://github.com/satish2352/krushi\_ai\_project.git
cd krushi\_ai\_project
```

\---

### 2\. Backend Setup (FastAPI — Port 8000)

```bash
cd backend

# Create & activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn app:app --reload --port 8000
```

> Backend runs at: `http://localhost:8000`

\---

### 3\. Frontend Setup (Next.js — Port 3000)

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

> Frontend runs at: `http://localhost:3000`

\---

### 4\. Open the App

Once both servers are running, open your browser at:

```
http://localhost:3000
```

Allow **GPS/location permission** when prompted — it powers crop recommendations, weather alerts, and nearby mandi prices.

\---

## 🤖 How It Works

1. User types a query (e.g. *"which crop for my soil?"*)
2. `router.ts` detects intent via keyword matching
3. Relevant modules fire — GPS + Soil data + AI models generate the response
4. **Gemini 2.5 Flash** analyzes soil \& recommends crops (with Random Forest as fallback)
5. **Groq LLaMA-3.3-70b** generates a conversational Hindi/English explanation
6. UI renders result cards — Crop / Fertilizer / Mandi / Weather / Yield

> Even if the backend is down, Groq still responds to the user.

\---

## 📡 Backend API Endpoints

|Endpoint|Description|
|-|-|
|`POST /predict/crop`|Crop recommendation (Gemini → pkl → rules)|
|`POST /soil/gap-analysis`|Fertilizer \& soil improvement plan|
|`POST /predict/yield`|Yield \& profit estimation|
|`POST /predict/pest`|Pest outbreak prediction|

\---

## 🎥 Demo

📹 See `Krishi AI Demo1.mp4` in the repository for a full walkthrough.

\---

## 👥 Contributors

**Vinayak Chavan** — [GitHub](https://github.com/vinayaksbchavan)

**Satish** — [GitHub](https://github.com/satish2352)

