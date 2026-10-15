import os
from pathlib import Path

ML_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ML_DIR / "data" / "generated"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"

DECISION_MODEL_PATH = MODELS_DIR / "decision.joblib"
SENTIMENT_MODEL_PATH = MODELS_DIR / "sentiment.joblib"
METRICS_PATH = MODELS_DIR / "metrics.json"

# KVKK: bu sayının altında cevabı olan derslerin analizi gösterilmez
MIN_RESPONSES = 5
RANDOM_STATE = 0

# joblib (loky) Windows'ta fiziksel çekirdek sayısını bulamayınca uyarı veriyor
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 1))


def _load_dotenv() -> None:
    """ml/.env varsa okur (python-dotenv bağımlılığı eklememek için basit ayrıştırıcı).

    Ortamda zaten tanımlı değişkenlerin üzerine yazılmaz.
    """
    env_file = ML_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def get_service_token() -> str | None:
    return os.environ.get("ML_SERVICE_TOKEN")
