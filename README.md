# X-tapnow

[English](./README.en.md) | [Simplified Chinese](./README.zh-CN.md)

X-tapnow is a node-based AI creation workspace with an infinite canvas for image, video, and text workflows.

## Highlights

- Infinite canvas with node/group workflow editing
- Multi-provider support for image, video, and text generation
- Local persistence (IndexedDB + localStorage)
- JSON import/export for workflows

## Quick Start

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Configuration

- No required env variable for startup
- API keys can be configured directly in the frontend Settings page
- Optional env template: [`.env.example`](./.env.example)

## Docker

```bash
docker compose up --build
```

## More Docs

- English full docs: [README.en.md](./README.en.md)
- Chinese full docs: [README.zh-CN.md](./README.zh-CN.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security: [SECURITY.md](./SECURITY.md)
- License: [LICENSE](./LICENSE)
