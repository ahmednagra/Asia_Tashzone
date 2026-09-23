# services/ — backend API layer

The only place that talks to the FastAPI backend. `api.ts` wraps `fetch` (base URL, JSON, bearer token) and exposes `api.appConfig`, `register`, `createRoom`, `joinRoom`. Response shapes are in `types/api.ts`. Split into one file per backend feature as it grows.
