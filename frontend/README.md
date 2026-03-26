# React

A modern React-based project utilizing the latest frontend technologies and tools for building responsive web applications.

## 🚀 Features

- **React 18** - React version with improved rendering and concurrent features
- **Vite** - Lightning-fast build tool and development server
- **Redux Toolkit** - State management with simplified Redux setup
- **TailwindCSS** - Utility-first CSS framework with extensive customization
- **React Router v6** - Declarative routing for React applications
- **Data Visualization** - Integrated D3.js and Recharts for powerful data visualization
- **Form Management** - React Hook Form for efficient form handling
- **Animation** - Framer Motion for smooth UI animations
- **Testing** - Jest and React Testing Library setup

## 📋 Prerequisites
## Frontend (React + Vite)

This project uses Vite + React (React 18) and Tailwind CSS. The frontend is built during the Docker build and served by nginx for the production image; during local development you can run the Vite dev server.

Prerequisites:
- Node.js 18+ and npm

Install and run (development):

```bash
cd frontend
npm install
cp .env.example .env
# If you want the frontend dev server to proxy to a local backend, set VITE_API_URL=http://localhost:5000/api in .env
npm run dev
```

The Vite dev server runs on port 5173 by default.

Build for production (static files):

```bash
cd frontend
npm run build
```

When using the repository's Docker setup, the frontend build is automatically created and copied into an nginx image that serves the app on port `3000`.

Useful scripts (in `frontend/package.json`):
- `npm run dev` — start Vite dev server
- `npm run build` — produce production build (in `frontend/dist`)
- `npm run serve` — preview production build locally via Vite preview

Notes
- Keep `VITE_API_URL` pointing to your backend API (e.g. `http://localhost:5000/api`) during development so the frontend can call the API.
- If you add native dependencies that require compilation (for example `sharp` for image processing), ensure the Dockerfile and CI environment include the OS packages required to build them (libvips, build-essential, etc.).

Project structure (high level):

```
frontend/
├─ src/ (React app)
├─ public/ (static)
├─ index.html
├─ package.json
└─ vite.config.js
```

If you'd like, I can add a short developer checklist for contributing to the frontend (linting, tests, local preview, design tokens).