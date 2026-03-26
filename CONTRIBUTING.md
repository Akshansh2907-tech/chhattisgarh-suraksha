# Contributing to Chhattisgarh Suraksha

Thank you for considering contributing to Chhattisgarh Suraksha! This document outlines the process for contributing and how to set up your development environment.

## Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Akshansh2907-tech/chhattisgarh-suraksha.git
   cd chhattisgarh-suraksha
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

   Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your PostgreSQL credentials.

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Database Setup**
   - Install PostgreSQL if not already installed
   - Create development and test databases:
     ```bash
     createdb chhattisgarh_suraksha
     createdb chhattisgarh_suraksha_test
     ```

## Running Tests

### Backend Tests
```bash
cd backend
npm test
```

Backend tests use a separate test database (`chhattisgarh_suraksha_test`). The test database is automatically set up with required tables when tests run.

### Frontend Tests
```bash
cd frontend
npm test
```

## CI/CD Pipeline

Our CI/CD pipeline uses GitHub Actions and consists of several jobs:

1. **Backend Job**
   - Runs on Ubuntu latest
   - Sets up Node.js 18.x
   - Uses PostgreSQL service for tests
   - Runs:
     - Dependency installation
     - Linting
     - Tests with database migrations

2. **Frontend Job**
   - Runs on Ubuntu latest
   - Sets up Node.js 18.x
   - Runs:
     - Dependency installation
     - Linting
     - Tests
     - Production build

3. **Docker Job**
   - Builds Docker images for both backend and frontend
   - Pushes images to GitHub Container Registry
   - Uses build caching for faster builds
   - Tags images with:
     - Git SHA
     - Branch name
     - PR number (for pull requests)
     - Semantic version (when tagged)

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests locally
4. Push your branch and create a pull request
5. Wait for CI checks to pass
6. Request review from maintainers

## Local Development with Docker

Build and run services locally:
```bash
docker-compose up --build
```

This will start:
- PostgreSQL database
- Backend service
- Frontend service

Access the services:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Database: localhost:5432