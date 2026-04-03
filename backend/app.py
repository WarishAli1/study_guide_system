import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth import login, users
from upload import upload_file
from config import Config
from report.api import router as report_router
from data.dataset_api import router as dataset_router
from chat.api import router as chat_router
from quiz.api import router as quiz_router
from analysis.api import router as analysis_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)

app = FastAPI(title="Exam Guide API")


@app.on_event("startup")
def on_startup():
    users.init_db()
    upload_file.init_uploads_table()


app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_file.router, prefix="/api", tags=["Upload"])
app.include_router(login.router, prefix="/auth", tags=["Auth"])
app.include_router(report_router, prefix="/api", tags=["Report"])
app.include_router(dataset_router, prefix="/api", tags=["Dataset"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(quiz_router, prefix="/api", tags=["Quiz"])
app.include_router(analysis_router, prefix="/api", tags=["Analysis"])


@app.get("/")
def home():
    return {"message": "System Running. Go to /docs to test."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=Config.HOST, port=Config.PORT, reload=Config.RELOAD)