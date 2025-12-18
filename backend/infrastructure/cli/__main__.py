#!/usr/bin/env python3
"""
CineRadar CLI - Clean Architecture Entry Point

This is the main entry point for the CineRadar scraper system.
It uses dependency injection to wire up use cases with implementations.

Usage:
    python -m backend.infrastructure.cli movies [options]
    python -m backend.infrastructure.cli seats [options]
    python -m backend.infrastructure.cli token [options]
    python -m backend.infrastructure.cli validate [options]
"""
import argparse
import asyncio
import sys
from datetime import datetime

from backend.config import CITIES


def create_movie_scraper():
    """Factory to create movie scraping use case with dependencies."""
    from backend.infrastructure.scrapers import TixMovieScraper
    from backend.infrastructure.repositories import (
        FirestoreMovieRepository,
        FirestoreTheatreRepository,
        FileMovieRepository,
    )
    from backend.application.use_cases import ScrapeMoviesUseCase
    
    scraper = TixMovieScraper()
    movie_repo = FirestoreMovieRepository()
    theatre_repo = FirestoreTheatreRepository()
    
    return ScrapeMoviesUseCase(scraper, movie_repo, theatre_repo)


def create_file_movie_scraper(data_dir: str = "data"):
    """Factory for file-based storage (no Firestore)."""
    from backend.infrastructure.scrapers import TixMovieScraper
    from backend.infrastructure.repositories import (
        FileMovieRepository,
        FirestoreTheatreRepository,
    )
    from backend.application.use_cases import ScrapeMoviesUseCase
    
    scraper = TixMovieScraper()
    movie_repo = FileMovieRepository(data_dir)
    theatre_repo = FirestoreTheatreRepository()
    
    return ScrapeMoviesUseCase(scraper, movie_repo, theatre_repo)


def run_movies(args):
    """Run movie scraping command."""
    print("\n" + "=" * 60)
    print("🎬 CineRadar - Movie Availability Scraper (Clean Architecture)")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d')}")
    print("=" * 60 + "\n")
    
    async def _run():
        # Determine cities
        if args.batch is not None:
            cities_per_batch = len(CITIES) // args.total_batches + 1
            start_idx = args.batch * cities_per_batch
            end_idx = min(start_idx + cities_per_batch, len(CITIES))
            cities = [c['name'] for c in CITIES[start_idx:end_idx]]
            print(f"🔢 Batch {args.batch}/{args.total_batches-1}: {len(cities)} cities")
        elif args.city:
            cities = [args.city.upper()]
        else:
            cities = None
        
        # Create and execute use case
        if args.local:
            use_case = create_file_movie_scraper(args.output)
            save_to_storage = False
        else:
            use_case = create_movie_scraper()
            save_to_storage = True
        
        result = await use_case.execute(
            cities=cities,
            fetch_schedules=args.schedules,
            save_to_storage=save_to_storage,
            sync_theatres=args.schedules,
            headless=not args.visible,
        )
        
        if result.success:
            print(f"\n✅ Success!")
            print(f"   🎬 Movies: {result.movie_count}")
            print(f"   🏙️ Cities: {result.cities_scraped}")
            print(f"   🏢 Theatres synced: {result.theatres_synced}")
        else:
            print(f"\n❌ Failed: {result.error}")
            return 1
        
        # Save to file if using batch mode
        if args.batch is not None:
            from backend.infrastructure.repositories import FileMovieRepository
            from backend.domain.models import ScrapeResult
            
            file_repo = FileMovieRepository(args.output)
            
            # Create result for file save
            date_str = datetime.now().strftime("%Y-%m-%d")
            scrape_result = ScrapeResult(
                movies=result.movies,
                scraped_at=datetime.utcnow().isoformat(),
                date=date_str,
                cities_scraped=result.cities_scraped,
            )
            
            # Save with batch suffix
            import json
            from pathlib import Path
            
            output_file = Path(args.output) / f"batch_{args.batch}_{date_str}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                data = scrape_result.to_dict()
                data['batch'] = args.batch
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print(f"💾 Saved to: {output_file}")
        
        return 0
    
    return asyncio.run(_run())


def run_validate(args):
    """Run data validation command."""
    from backend.application.use_cases import ValidateDataUseCase
    
    use_case = ValidateDataUseCase(
        min_movies=args.min_movies,
        min_cities=args.min_cities,
    )
    
    result = use_case.validate_file(args.file)
    
    print(f"📂 Validating: {args.file}")
    print(f"   🎬 Movies: {result.movies}")
    print(f"   🏙️ Cities: {result.cities}")
    
    if result.errors:
        print(f"❌ Errors ({len(result.errors)}):")
        for err in result.errors[:5]:
            print(f"   • {err}")
    
    if result.warnings:
        print(f"⚠️ Warnings ({len(result.warnings)}):")
        for warn in result.warnings[:3]:
            print(f"   • {warn}")
    
    if result.valid:
        print("\n🎉 Validation PASSED!")
        return 0
    else:
        print("\n💥 Validation FAILED!")
        return 1


def run_token(args):
    """Run token commands."""
    from backend.infrastructure.repositories import FirestoreTokenRepository
    
    repo = FirestoreTokenRepository()
    
    if args.check:
        token = repo.get_current()
        if token:
            print(f"📋 Token Info:")
            print(f"   Stored at: {token.stored_at}")
            print(f"   Expires at: {token.expires_at}")
            print(f"   Minutes remaining: {token.minutes_until_expiry}")
            print(f"   Status: {token.get_status_message()}")
        else:
            print("❌ No token found")
        return 0
    
    if args.check_min_ttl is not None:
        token = repo.get_current()
        if not token:
            print("❌ No token found")
            return 1
        
        if token.minutes_until_expiry >= args.check_min_ttl:
            print(f"✅ Token valid for {token.minutes_until_expiry} min (need {args.check_min_ttl})")
            return 0
        else:
            print(f"❌ Token only valid for {token.minutes_until_expiry} min (need {args.check_min_ttl})")
            return 1
    
    # Default: run token refresh
    # Fall back to legacy script for now
    from backend.scrapers.refresh_token import main as legacy_main
    return legacy_main()


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description='CineRadar - TIX.id Movie & Seat Scraper (Clean Architecture)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.infrastructure.cli movies --city JAKARTA
  python -m backend.infrastructure.cli movies --batch 0 --total-batches 9
  python -m backend.infrastructure.cli validate --file data/movies_2025-12-18.json
  python -m backend.infrastructure.cli token --check
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Movies subcommand
    movies_parser = subparsers.add_parser('movies', help='Scrape movie availability')
    movies_parser.add_argument('--visible', action='store_true', help='Show browser window')
    movies_parser.add_argument('--city', type=str, help='Scrape specific city')
    movies_parser.add_argument('--schedules', action='store_true', help='Include showtimes')
    movies_parser.add_argument('--output', default='data', help='Output directory')
    movies_parser.add_argument('--batch', type=int, help='Batch number (0-indexed)')
    movies_parser.add_argument('--total-batches', type=int, default=9)
    movies_parser.add_argument('--local', action='store_true', help='Save to file only, no Firestore')
    
    # Validate subcommand
    validate_parser = subparsers.add_parser('validate', help='Validate movie data')
    validate_parser.add_argument('--file', '-f', required=True, help='File to validate')
    validate_parser.add_argument('--min-movies', type=int, default=10)
    validate_parser.add_argument('--min-cities', type=int, default=50)
    
    # Token subcommand
    token_parser = subparsers.add_parser('token', help='Token management')
    token_parser.add_argument('--check', action='store_true', help='Check current token')
    token_parser.add_argument('--check-min-ttl', type=int, help='Check min TTL in minutes')
    token_parser.add_argument('--refresh', action='store_true', help='Refresh token')
    
    args = parser.parse_args()
    
    if args.command == 'movies':
        sys.exit(run_movies(args))
    elif args.command == 'validate':
        sys.exit(run_validate(args))
    elif args.command == 'token':
        sys.exit(run_token(args))
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
