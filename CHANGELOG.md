# Changelog

All notable changes to CineRadar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-18

### Added
- **Clean Architecture refactoring** - Complete restructure of backend
  - `domain/` layer with pure Python models (Movie, Theatre, Token, etc.)
  - `application/` layer with ports (interfaces) and use cases
  - `infrastructure/` layer with scrapers and repositories
- **Custom exception hierarchy** - 12 typed errors (TokenExpiredError, etc.)
- **Repository pattern** - Abstraction for Firestore and file storage
- **Use case classes** - ScrapeMoviesUseCase, ValidateDataUseCase
- **Comprehensive test suite** - 53 tests covering all layers
- **New CLI** - `python -m backend.infrastructure.cli`

### Changed
- **Pydantic schemas** - Now integrated with domain models
- **Error handling** - Using domain errors instead of bare exceptions

## [1.5.0] - 2025-12-16

### Added
- **Pydantic V2 schemas** for data validation
- **Integrity checks** in GitHub Actions workflow
- **Token TTL verification** before seat scraping

### Changed
- Updated daily-scrape.yml with validation step
- Added --check-min-ttl flag to refresh_token.py

## [1.0.0] - 2025-12-01

### Added
- Initial release
- Movie availability scraping from TIX.id
- Seat occupancy scraping
- Admin dashboard with Next.js
- Public web interface
- GitHub Actions for daily scraping
