# X-tapnow

X-tapnow is a node-based AI creation workspace with an infinite canvas for image, video, and text workflows.

## Features

- Infinite canvas with node/group workflow editing
- Image generation and text generation provider support
- Video generation and task polling support
- Local persistence (IndexedDB + localStorage)
- JSON import/export for project workflows

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- idb-keyval for IndexedDB persistence

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create local env file from template:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

No required variable for startup.
You can configure API keys directly in the frontend Settings page.
If needed, you can still prefill environment variables:

```env
VITE_GEMINI_API_KEY=your_key_here
```

Note: `GEMINI_API_KEY` is still supported for backward compatibility.

### 3. Run locally

```bash
npm run dev
```

### 4. Build production bundle

```bash
npm run build
```

## Environment Variables

- `VITE_GEMINI_API_KEY`: optional; can be configured in frontend Settings instead
- `VITE_UPLOAD_PROXY_TARGET`: optional dev proxy target for `/api/upload`
- `VITE_SORA_API_BASE_URL`: optional default character API base URL
- `VITE_SORA_CHARACTER_TOKEN`: optional default character token (not recommended for shared/public deployments)
- `VITE_DEV_SERVER_PORT`: optional dev server port (default `3000`)
- `VITE_DEV_SERVER_HOST`: optional dev server host (default `0.0.0.0`)

## Security Notes

- Do not commit `.env`, `.env.local`, or any real keys/tokens
- Project export now redacts provider `apiKey` values by default
- Character token is excluded from exported project data by default

## Docker

```bash
docker compose up --build
```

## Contributing

Please read `CONTRIBUTING.md` before submitting issues or pull requests.

## Security Reporting

Please read `SECURITY.md` for responsible vulnerability disclosure.

## License

This project is licensed under the MIT License. See `LICENSE`.
