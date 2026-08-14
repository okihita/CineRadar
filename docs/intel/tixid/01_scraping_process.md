# TIX ID API Scraping Process

This document outlines the reverse-engineered scraping process for the TIX ID platform (`app.tix.id` / `api-b2b.tix.id`). The workflow relies on direct API calls rather than browser automation to maximize efficiency and minimize load.

## 1. Authentication Flow (Guest & Login)

TIX ID employs a strict 30-minute rotating "Guest Token" mechanism to prevent primitive bot replay attacks, coupled with RSA-2048 asymmetric encryption for login credentials.

### Swimlane Diagram: Authentication

```mermaid
sequenceDiagram
    participant Scraper as Python Scraper
    participant API as TIX ID B2B API (api-b2b.tix.id)
    
    Note over Scraper: Step 1: Initialize Guest Session
    Scraper->>API: POST /v1/auth (client_id: tixid_guest)
    API-->>Scraper: Return 30-min valid JWT Token
    Scraper->>Scraper: Store "Guest Token" as Bearer
    
    Note over Scraper: Step 2: Extract & Encrypt Password
    Scraper->>Scraper: Pad Password + Encrypt with Hardcoded RSA Public Key
    
    Note over Scraper: Step 3: Login using Guest Token
    Scraper->>API: POST /v1/users/login (Auth: Bearer GuestToken, payload: MSISDN + RSA_PW)
    API-->>Scraper: Return User JWT Token & Refresh Token
    Scraper->>Scraper: Store "User Token" for subsequent calls
```

> [!NOTE] 
> **Ground Truth Login Payload:**
> - Request: [`raw_payloads/02_auth_login.request`](./raw_payloads/02_auth_login.request)
> - Response: [`raw_payloads/02_auth_login.response`](./raw_payloads/02_auth_login.response)

### Encryption Details
- The client encapsulates the `password` in a 344-character Base64 encoded payload.
- This represents a 256-byte output standard to **RSA-2048 encryption**.
- The public key is hardcoded directly into the `main.dart.js` output of their Flutter web app.
- Because asymmetric encryption is used, server-side interception without the private key cannot determine user passwords.

## 2. Daily Showtimes Scraping Sequence (Morning Scrape)

To avoid useless API calls checking showtimes for pre-sale movies or movies not airing today, we use an iterative 4-step "funnel" approach.

### Swimlane Diagram: Showtimes

```mermaid
sequenceDiagram
    participant Scraper as Python Scraper
    participant DB as Local City Data
    participant API as TIX B2B API (/v1/movies & /v1/schedules)
    
    loop Every City
        Scraper->>DB: Get next city_id
        
        Note over Scraper: Fetch Now Playing Movies
        Scraper->>API: GET /v1/movies?city_id={id}&movie_type=NOW_PLAYING
        API-->>Scraper: List of movies (movie_id, title)
        
        loop Every Movie in City
            Note over Scraper: Check Active Dates
            Scraper->>API: GET /v1/schedules/date?schedule_id={movie_id}&city_id={id}
            API-->>Scraper: Dates array []
            
            alt Has Today's Date AND is_any_schedule=true?
                Note over Scraper: Fetch Detailed Theaters & Showtimes
                Scraper->>API: GET /v1/schedules/movies/{movie_id}?city_id={id}&date={today}
                API-->>Scraper: Theaters, Pricing, and Showtimes
                Scraper->>Scraper: Save detailed schedules to DB
            else No Schedule Today
                Scraper->>Scraper: Skip movie (Presale or airing later)
            end
        end
    end
```

## 3. Rate Limiting & Optimization
- **Do not brute-force dates:** Always use `/v1/schedules/date` before requesting full theater/showtime objects. The date check is heavily cached by TIX ID on their CDNs and significantly reduces load.
- **Pagination:** Check the `has_next` boolean on `/v1/schedules/movies`. Highly populated cities (e.g., Jakarta) for popular movies may span multiple API pages.
