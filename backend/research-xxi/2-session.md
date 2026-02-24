# M-Tix Session Response Analysis

The `session.txt` file contains the server's response upon a successful login or session validation. This object is what the NextAuth frontend saves into the client session state.

## Deep Analysis of Fields

### 1. Encrypted User Identifiers
The `user.content.email` and `user.content.msisdn` fields are returned from the server as encrypted strings. 
They use the exact same algorithm and key as the *Request Payload Encryption* detailed in `RESEARCH_LOGIN.md`.
- **Encryption Algorithm**: CryptoJS AES (`Salted__` signature)
- **Key**: `567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T`

**Decrypted Values:**
- `email`: `okihita@gmail.com`
- `msisdn`: `6281335607447` (Note that it uses the `62` country code prefix, not `08` like the input credential).

### 2. Standard User Content
- `member_id`: `ROW8133560744721123017174309` 
  - *Format*: `ROW` + `[Phone Number (without 0)]` + `[Timestamp/Random string]`. This acts as the primary key when making transaction/history requests.
- `name`: `Okihita Hasiholan Sihaloho`
- `sid`: `1eb35f58d2b9a0c486effabaea1fc716` (Underlying PHP session ID or backend token).

### 3. Server-side Tokens
- **`refresh_token`**: A standard UUID form (`c3a318a3...`). Used to obtain a new token when the current JWT expires without asking the user for their PIN again.
- **`token`**: The primary authorization token sent via `Authorization: Bearer <token>` in subsequent API calls.
  - **Type**: JSON Web Token (JWT)
  - **Algorithm**: HS256

**Decoded JWT Payload:**
```json
{
  "MemberID": "ROW8133560744721123017174309",
  "iss": "ROW8133560744721123017174309",
  "nbf": 1771929300,
  "iat": 1771929300
}
```
*Note: The JWT payload lacks an `exp` (expiration) field.*

### 4. Next.js / NextAuth Session Wrapper
At the root level, `session.txt` tracks standard web auth fields:
- `iat`: JWT issue time in seconds.
- `exp`: Defines the absolute backend session expiration. `1810809482` correlates to early **2027**, indicating that M-Tix mobile sessions have extremely long lifetimes (1+ years) before forcing a hard re-authentication.
- `expires`: `2027-05-20T10:40:11.729Z`, aligning with the timestamp limits above.

## Impact for Automation
Because the session lifetimes scale to over a year, and we now have the mechanism to natively invoke the initial login:
1. We can login once to obtain the `token`.
2. Storing the `token` and `refresh_token` will allow fully authenticated, persistent requests indefinitely.
3. Access to `member_id` allows programmatic extraction of user tickets and bookings via other internal endpoints.

## Security & Architecture Assessment

From a security and system architecture standpoint, this session implementation is **BAD** for several critical reasons:

1. **"Security Theater" via Client-Side Encryption**
   - The backend encrypts sensitive fields (`email`, `msisdn`) and the frontend decrypts them using a **hardcoded symmetric key** (`567G553Yz6r...`).
   - This provides **zero real security** against a malicious actor or reverse-engineer. Since the key is shipped to every user's browser, anyone can decrypt the data (as demonstrated by our scripts). It is merely "security by obscurity," adding processing overhead for a false sense of protection.

2. **Non-Expiring JWT Tokens**
   - The primary access `token` (the JWT) lacks the `exp` (expiration) claim. 
   - By definition, this makes the token valid indefinitely (or until the backend manually revokes the `MemberID` in their database, which defeats the stateless purpose of a JWT). Best practice dictates JWTs should have short lifespans (e.g., 15-60 minutes).

3. **Dangerously Long Session Lifetimes**
   - The overall NextAuth session (`expires` field) is set to last for over a year (May 2027). 
   - Combined with the non-expiring JWT, if an attacker steals a user's `session.txt` payload, they have **permanent, unfettered access** to the account, points, and tickets without ever needing to enter the user's PIN or phone number again.

4. **Redundant Authentication Mechanisms (Tech Debt)**
   - The payload returns a `member_id`, a JWT `token`, a `refresh_token`, and a PHP `sid` (Session ID). 
   - This indicates a messy architectural transition. They likely have a legacy monolithic backend (PHP) that relies on the `sid`, which they hastily wrapped in a modern Next.js/NextAuth layer relying on JWTs. This results in maintaining multiple conflicting session states simultaneously.
