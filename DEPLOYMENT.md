# Docker Deployment

## 1) Build and push to Docker Hub

Replace `YOUR_DOCKERHUB_USER` with your Docker Hub username.

```bash
docker login
docker build -t YOUR_DOCKERHUB_USER/victora-frontend:latest .
docker push YOUR_DOCKERHUB_USER/victora-frontend:latest
```

Optional multi-arch image:

```bash
docker buildx create --use --name victora-builder || true
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_DOCKERHUB_USER/victora-frontend:latest --push .
```

## 2) Run on server / Portainer (frontend only)

Use the provided compose file and adjust the image name if needed.

The image is prepared so that:
- `env.js` is generated at container startup from environment variables
- nginx proxy config is generated at container startup from environment variables
- no bind-mount is required (important for Portainer stacks)

For nginx proxy targets, use separate variables for scheme and host, e.g.:
- `NGINX_API_SCHEME=https`
- `NGINX_API_HOST=victora-api.schischos-lodge.com`

```bash
docker compose -f docker-compose.frontend.yml pull
docker compose -f docker-compose.frontend.yml up -d
```

The app is then reachable on port `8080` of your server.

## 3) Domain setup for `victora.schischos-lodge.com`

Create an A/AAAA DNS record:
- `victora.schischos-lodge.com -> <your server IP>`

Recommended: use a reverse proxy with TLS (Caddy or Nginx) in front of the frontend container.

### Caddy example

- Copy `docker/Caddyfile.example` to your server as `Caddyfile`.
- Replace `backend:5000` with your backend service host:port (or keep if your backend container is named `backend` in same Docker network).

Minimal compose sketch:

```yaml
services:
  frontend:
    image: YOUR_DOCKERHUB_USER/victora-frontend:latest
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend

volumes:
  caddy_data:
  caddy_config:
```

## 4) Important backend routing note

The frontend uses `VITE_API_PREFIX=/api` (default). That means browser calls go to:
- `/api/*`
- `/public/*`
- `/hubs/*`

Your reverse proxy must route these paths to the backend service and all other paths to the frontend container.

If you use the provided image setup, this is already handled inside the
frontend container for:
- `/api/*`
- `/public/tournaments/*`
- `/hubs/*`

The rest still falls back to the SPA frontend.

## 5) Update rollout

```bash
docker compose -f docker-compose.frontend.yml pull
docker compose -f docker-compose.frontend.yml up -d
```

