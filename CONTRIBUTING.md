# Contributing to CineRadar

Thank you for your interest in contributing to CineRadar! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (for admin/web frontends)
- Firebase project with Firestore enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/CineRadar.git
cd CineRadar

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install Python dependencies
pip install -r requirements.txt

# Install test dependencies
pip install pytest ruff mypy

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_domain_models.py -v

# Run with coverage
pytest tests/ --cov=backend
```

### Linting

```bash
# Check for issues
ruff check backend/

# Auto-fix issues
ruff check backend/ --fix

# Type checking
mypy backend/domain/
```

## Architecture Overview

CineRadar follows **Clean Architecture** principles:

```
backend/
├── domain/           # Pure business objects (no external deps)
│   ├── models/       # Dataclasses: Movie, Theatre, Token
│   └── errors.py     # Custom exception hierarchy
│
├── application/      # Business logic layer
│   ├── ports/        # Abstract interfaces (ABC)
│   └── use_cases/    # Application workflows
│
├── infrastructure/   # External implementations
│   ├── scrapers/     # TIX.id scraping
│   ├── repositories/ # Firestore/File storage
│   └── cli/          # Command line interface
│
└── schemas/          # Pydantic validation
```

### Key Principles

1. **Domain layer has no external dependencies** - Pure Python only
2. **Application layer defines interfaces** - Infrastructure implements them
3. **Dependency Injection** - Use cases receive dependencies via constructor
4. **Use domain errors** - Never catch bare `Exception`

## Making Changes

### Adding a New Feature

1. **Start with domain models** if new entities are needed
2. **Define ports** (interfaces) in application layer
3. **Implement in infrastructure** layer
4. **Add tests** for each layer

### Adding a New City

1. Edit `backend/config.py` and add to `CITIES` list
2. Run scraper with `--city NEWCITY` to test
3. Verify output in `data/` directory

### Adding a New Error Type

```python
# backend/domain/errors.py
class MyNewError(ScrapingError):
    """Description of when this error occurs."""
    
    def __init__(self, message: str, context: str = None):
        super().__init__(message, {"context": context} if context else {})
```

## Pull Request Guidelines

1. **Tests required** - All new code must have tests
2. **Lint clean** - Run `ruff check` before submitting
3. **Small PRs** - Prefer small, focused changes
4. **Clear descriptions** - Explain what and why

## Code Style

- Use type hints for all function parameters and returns
- Use docstrings for public functions and classes
- Follow PEP 8 naming conventions
- Keep functions under 50 lines when possible

## Questions?

Open an issue or reach out to the maintainers.
