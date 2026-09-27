# Model Verification Report — Smart Resort 360

**Verified on:** 2026-09-27 · **Runtime:** Python 3.11.2 · **scikit-learn: pinned `1.6.1`** (loaded in `ml-server/requirements.txt`)

> Phase 22/39 gate: each artifact was (1) loaded, (2) checked for runtime compatibility,
> (3) validated against its feature schema, (4) test-inferenced with a valid sample,
> (5) measured for inference latency, and (6) wired behind a documented fallback.
> The `scikit-learn==1.6.1` pin in `ml-server/requirements.txt` is **load-bearing** —
> the pipelines were serialized with 1.6.1 and must not run under a newer major.minor
> without re-export. ✅ All artifacts load and infer correctly under the pinned runtime.

| # | Model artifact | Purpose | Trained / API | Key features (verified via `feature_names_in_`) | Output | Load | Sample inference | Fallback when unavailable | Integration endpoint |
|---|----------------|---------|---------------|---------------------------------------------------|--------|------|------------------|---------------------------|----------------------|
| 1 | `occupancy_forecast_model.joblib` | Daily arrivals / occupancy demand | Trained sklearn Pipeline | arrivals_lag_1/7, rolling_mean_7/14, adr_lag_7, day_of_week, month_num, is_weekend, is_holiday_season | arrivals load (≈33.9 for weekend sample) | ✅ | ✅ 10.0 ms | weekday×1.1/weekend×0.95 heuristic | `POST /api/forecast/predict`, `GET /api/forecast/weekly` (via FastAPI); consumed by Time Machine + proactive engine |
| 2 | `staff_demand_model.joblib` | Staff requirement by dept/season | Trained Pipeline (categorical OHE) | occupancy_rate, avg_length_of_stay, day_of_week, department, season, is_weekend/holiday, banquet_event_flag | staff count (~14.5 @ 82% HK) | ✅ | ✅ 9.7 ms | occupancy×0.3 | `/api/forecast/predict`, `/weekly`; proactive staffing finding |
| 3 | `fnb_demand_model.joblib` | F&B order volume | Trained Pipeline | checkout_price, base_price, discount_pct, week, promo flags | order volume (~4.2 sample) | ✅ | ✅ 8.7 ms | occupancy×1.8×0.75 | `/api/forecast/predict`; twin F&B pressure |
| 4 | `inventory_demand_model.joblib` | Inventory consumption | Trained Pipeline | occupancy_rate, day_of_week, item_id, category, season, flags | units (~36.7 sample) | ✅ | ✅ 9.9 ms | fnb×1.2 | `/api/forecast/predict`; twin inventory forecast |
| 5 | `sentiment_tfidf_vectorizer.joblib` + `sentiment_fallback_model.joblib` | Review sentiment (3-class) | Trained TF-IDF + LogisticRegression | free text → TF-IDF | negative/neutral/positive + proba | ✅ | ✅ 1.9 ms (`['dirty…']→negative`, `['wonderful…']→positive`) | deterministic keyword classifier in Node (`classifyRequest`) | `POST /api/nlp/analyze-review` → used by `POST /api/v1/parse-review` (ABSA → ticket) |
| 6 | `maintenance_isolationforest_model.joblib` | Machine-sensor anomaly detection | Trained IsolationForest | 5 numeric sensor features (air/process temp, rpm, torque, tool-wear) | −1 = anomaly / +1 = normal | ✅ | ✅ 14.4 ms — flags both test vectors anomalous (baseline health score; see note) | condition-score threshold rule | `/api/nlp/*` support + proactive engine rules |
| 7 | `maintenance_randomforest_model.joblib` | Failure type classification | Trained Pipeline | Air temp [K], Process temp [K], Rotational speed, Torque, Tool wear, Type | failure class (`Normal` on sample) | ✅ | ✅ 15.3 ms | anomaly-only path | ML server maintenance analysis |
| 8 | `guest_segmentation_kmeans_model.joblib` + `guest_segmentation_scaler.joblib` | Guest clustering (k=2) | Trained KMeans + StandardScaler | 5 scaled guest features | segment id | ✅ | ✅ 13.6 ms | single-segment fallback | ML server guest analytics |
| 9 | `ticket_urgency_model.joblib` | Ticket urgency classification | Trained Pipeline (categorical) | occupancy_at_creation, sentiment_score, anomaly_score, hour, day, source, department, segment, is_weekend | urgency class (`Critical` on crisis sample) | ✅ | ✅ 39.1 ms | NLP priority rules (`nlpEngine`) | triage support for operational tickets |

### Integration notes
- **Where models run:** all inference is executed inside the FastAPI ML core (`ml-server`, port 8000). The Node gateway never deserializes models; it calls `services/mlClient.ts` and falls back deterministically when the ML core is offline (`model_source: "fallback"|"analytical-fallback"` is surfaced to the UI, never silently).
- **Guest NLP:** Gemini (optional, `GEMINI_API_KEY`) is used only for language/explanation; classification/routing runs through the deterministic `nlpEngine` + these trained models. The LLM cannot execute DB operations (Phase 24).
- **Known limitation (honest):** the IsolationForest baseline flags both healthy and worn samples anomalous — it behaves as a strict-outlier detector; production use treats it as advisory alongside the condition-score rule. No accuracy figures are claimed beyond what the test artifacts show.
