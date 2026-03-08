# CineRadar: M-Tix (Cinema XXI) Research & Web Scraping Documentation

This directory (`research-xxi`) contains our foundational reverse-engineering and API analysis for the `m.21cineplex.com` system. 

By analyzing network traffic from their Next.js frontend to internal microservices (like `apps-api`), we successfully bypassed their "Security Theater" payload encryption to build a robust, scalable, API-level scraping methodology.

## Reading Order & Documentation

To understand how the scraper works, review the documentation in this order:

1. **[1-login.md](./1-login.md)**
   * **Subject:** Global AES Payload Encryption.
   * **Takeaway:** Explains how we discovered the master AES keys (`567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T`) used by the frontend to encrypt JSON payloads. This key unlocks all subsequent API requests. Includes a working Node.js Proof of Concept stringifier.

2. **[2-session.md](./2-session.md)**
   * **Subject:** Decrypting User Session Metadata.
   * **Takeaway:** Shows how the `X-FINGERPRINT-DATA` header decrypts into a comprehensive user session object, exposing NextAuth integration and user IDs.

3. **[3-now-playing.md](./3-now-playing.md)**
   * **Subject:** Movie Discovery & Global Availability.
   * **Takeaway:** Analyzes the plaintext `GET` request for city-specific movie configurations. Details UUIDs, advanced ticket sale (`is_ats`) flags, and the base movie schemas.

4. **[4-movie-details.md](./4-movie-details.md)**
   * **Subject:** Deep Metadata Collection.
   * **Takeaway:** Details the plaintext `GET` request for deep movie info (Localized Indonesian synopsis, direct high-res CDN links for posters and trailers, and full Cast & Crew comma-strings).

5. **[5-schedules.md](./5-schedules.md)**
   * **Subject:** Decrypting Showtimes & Ticket Prices.
   * **Takeaway:** Demonstrates how to encrypt the `parent_movie_id` and `city_id` into a POST payload to receive the deeply nested, highly accurate physical GPS locations of cinemas and their `time_show` vs `ticket_price` arrays.

6. **[6-seatings.md](./6-seatings.md)**
   * **Subject:** Real-Time Live Occupancy Polling.
   * **Takeaway:** Explains how to map the parameters acquired in the Schedule API into a final encrypted payload to return the physical delimited string of a theater room (`A1#free;A2#col`), allowing us to accurately calculate live capacity vs. booked seats.

7. **[7-scraping-plan.md](./7-scraping-plan.md)**
   * **Subject:** Architecture & The Dual-Source Approach.
   * **Takeaway:** The master architectural blueprint. Details how we merge the exclusive XXI live-seat data from these endpoints with the rich meta-aggregator data from the existing **TIX ID** API scraper to build the ultimate Box Office Analytics dashboard.

## Request/Response Snapshots

The folder also contains raw `.request` (containing the exact cURL setup including cookie and header fingerprints) and `.response` files that correspond to the research documents. These serve as isolated testbeds if the API shape ever changes.

- `login.request`
- `now-playing.request` / `now-playing.response`
- `movie-details.request` / `movie-details.response`
- `schedules.request` / `schedules.response`
- `seatings.request` / `seatings.response`

*(Note: There are also lightweight node scripts like `test-encrypt.js` and `test-decrypt.js` used to fast-test payload encodings).*
