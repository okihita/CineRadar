"""CineRadar CLI (The Entry Point) 🎮.

Technical Explanation:
The **CLI** acts as the "Main Controller" or "Composition Root" for the application.

- **Dependency Injection**: This is the ONLY place where we are allowed to import everything. The CLI imports `infrastructure` classes (like `FirestoreMovieRepository`) and injects them into `application` Use Cases.
- **Orchestration**: It parses command line arguments and triggers the appropriate Use Case.
- **No Business Logic**: the CLI should not contain business rules (like "don't scrape if X"). It should just pass the command to the Use Case.

This keeps the entry point thin and the business logic portable.
"""
