# NeuroGut — Deployment & Readiness

## Run it (one command)

```bash
docker compose up -d --build          # http://localhost      (nginx on port 80)
NEUROGUT_PORT=8080 docker compose up -d --build   # if port 80 is taken
docker compose down                   # stop (data kept in Docker volumes)
```

Three containers: **nginx** (only public port) → **frontend** (Next.js) and **backend** (FastAPI + models).
The browser calls `/api/...` on the same origin, so the same images work on a laptop, a lab server or a cloud VM
without rebuilding. Set `JWT_SECRET` in a `.env` file next to `docker-compose.yml` before any shared use.

Local development is unchanged (`start_backend.bat`, `start_frontend.bat`; frontend talks to `localhost:8000`).

## Readiness (rubric: Solution Viability & Deployment Readiness)

| Aspect | What we did | Evidence |
|---|---|---|
| **Real-world data robustness** | Models validated on **unseen cohorts** (leave-one-study-out), not just random splits. Input harmonised: 0.01 % detection floor, log transform, taxon names accepted in 3 spellings, missing taxa = not detected. | SCZ LOSO AUC 0.62 (95 % CI 0.57–0.68), permutation p = 0.002; internal 0.71 |
| **Failure handling** | Invalid input rejected with a clear 422 (non-numeric, outside 0–100 %, rank sums > 100 %); bad CSV rows reported per row, good rows still scored; unknown disease/patient → 404. | 27 API tests (`neurogut-backend/tests`) |
| **Inference cost** | CPU only, no GPU. One prediction incl. per-patient explanation ≈ **66 ms**; models 9 MB; model load ≈ 6 s once at startup. | measured on a laptop CPU |
| **Scale** | Stateless API → add backend replicas behind nginx; batch CSV upload for many patients. SQLite is fine for a demo/single clinic; switch `DATABASE_URL` to PostgreSQL for multi-user (SQLAlchemy, no code change). | `docker-compose.yml`, `db/database.py` |
| **Operations** | Health check gates startup (nginx waits for a healthy backend); `restart: unless-stopped`; DB and reports on persistent volumes; audit trail of every prediction. | `docker-compose.yml` |
| **Maintenance** | Model is a versioned file (`models/v2/*.joblib`) produced by a reproducible pipeline (`research/.../sczml/deploy.py`, seed 42); retrain → replace file → restart. Model card shows version, training size, metrics. | `/api/v2/models` |
| **Integration** | REST API with OpenAPI docs (`/docs`); CSV templates matching standard MetaPhlAn output; PDF reports; JWT auth with roles. | Swagger UI |
| **Security** | Only nginx is exposed; secrets from environment; passwords hashed (bcrypt). | |

## Trade-offs we chose (and why)

- **Accuracy vs. honesty:** we report the unseen-cohort AUC (0.62) rather than the higher single-cohort figures (0.74–0.85), because a new clinic *is* an unseen cohort.
- **Small, explainable ensemble (RF + XGBoost + Elastic Net, 30 taxa) vs. larger models:** larger search (144 variants) gave no reliable gain; the small model is fast, cheap and its drivers can be shown per patient.
- **Single-patient scoring vs. batch normalisation:** per-cohort scaling helped slightly but needs a batch of samples, so it cannot score one patient — not used.
- **SQLite vs. PostgreSQL:** zero-setup for demos; one environment variable to switch.

## Limits (stated, not hidden)

- Research decision-support tool, **not a diagnostic device**; not clinically validated.
- Performance falls on cohorts unlike the training ones (different country/sequencer); more cohorts is the main lever.
- Expects shotgun metagenomic (MetaPhlAn-style) relative abundances; 16S input is not supported.
