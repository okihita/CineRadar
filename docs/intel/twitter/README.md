# CinePoint Twitter Scraping Research

This directory contains research and raw data snapshots for scraping CinePoint's Twitter timeline (@cinepoint_). This data is used to automate the collection of showtime counts and estimated admissions for benchmarking against CineRadar data.

## Files

- **`cinepoint_tweets.json`**: A processed list of tweets or search results.
- **`cinepoint_tweets.request`**: The raw cURL request used to fetch the timeline via Twitter's GraphQL API.
- **`raw_responses/`**: 
  - `1.response` through `7.response`: Sequential JSON responses from the Twitter API containing the timeline entries.

## Usage

These files serve as a reference for:
1. Identifying the GraphQL endpoint and required headers for timeline scraping.
2. Understanding the nested JSON structure of Twitter's response for building a robust parser.
3. Testing the regex patterns defined in `COMPETITOR_TRACKING_PLAN.md` against real-world tweet text.

---
*Note: The `.request` file contains session cookies. Handle with care.*
