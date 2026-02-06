from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from upload import upload_file
from auth import login, users

app = FastAPI(title="Exam Guide API")

@app.on_event("startup")
def on_startup():
    users.init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_file.router, prefix="/api", tags=["Upload"])
app.include_router(login.router, prefix="/auth", tags=["Auth"])

@app.get("/")
def home():
    return {"message": "System Running. Go to /docs to test."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)