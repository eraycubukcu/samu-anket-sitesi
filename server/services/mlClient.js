// ML servisi (ml/, FastAPI) için HTTP istemcisi.

const REQUEST_TIMEOUT_MS = 60_000;

export class MlServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const isMlConfigured = () =>
  Boolean(process.env.ML_SERVICE_URL && process.env.ML_SERVICE_TOKEN);

export const analyzeWithMl = async (payload) => {
  if (!isMlConfigured()) {
    throw new MlServiceError(
      503,
      "Analiz servisi yapılandırılmamış (ML_SERVICE_URL / ML_SERVICE_TOKEN eksik).",
    );
  }

  let response;
  try {
    response = await fetch(`${process.env.ML_SERVICE_URL.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ML-Token": process.env.ML_SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("ML servisi hatası:", error.message);
    throw new MlServiceError(503, "Analiz servisine ulaşılamıyor, lütfen daha sonra tekrar deneyin.");
  }

  const body = await response.json().catch(() => ({}));

  if (response.status === 401) {
    console.error("ML servisi token'ı reddetti; ML_SERVICE_TOKEN değerlerini kontrol edin.");
    throw new MlServiceError(502, "Analiz servisi anahtarı hatalı (sunucu yapılandırması).");
  }
  if (!response.ok) {
    console.error("ML servisi hata döndü:", response.status, body);
    const detail = typeof body.detail === "string" ? body.detail : "Analiz yapılamadı.";
    throw new MlServiceError(response.status === 503 ? 503 : 502, detail);
  }

  return body;
};
