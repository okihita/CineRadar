# Analysis: TIX ID Login & Payload Encryption

This document analyzes the `login` request payload sent by the TIX ID web application (`app.tix.id`) to their B2B backend (`api-b2b.tix.id`) and explores the feasibility of decrypting intercepted credentials.

## 1. The Login Payload Structure

When a user logs in, the client issues a POST request with the following JSON structure:

```json
{
  "msisdn": "+6281335607447",
  "password": "nbl5BvN9JeTvyO7KvF5RjEkRBaM12h/bNpBKeLRSt6foMjIhMjGIXXo5aqeEj4UM0TnoXMvfp7aNY+eMUptdakF7E8D86XwZ2yc1ZJg3vgrIXyFpX6WnmPOoetyLHpF6A+IrTbDDcF3aPiWKwIos7HrBlnh65wWSIqgL2FhabH/oAI7ddjNZrwFba2N1JpYpeCgwAQILmHTMD/TY8tJld9yU7GnR/vjXp5lEdt7Za0qqgYx5J+jBlUvzK+iAAGbKvYv/Ixdc/si24axqU611GA5m/OMpGire0eWPGh+bR8xEhtiJX/8hcVPbAJRP++sDk+LT+5FMyoygTMD+jDCJ0w=="
}
```

The `password` string is a **344-character Base64 encoded** block. When Base64 decoded, this string is exactly **256 bytes**.

## 2. Decryption Feasibility: Asymmetric RSA

The 256-byte output is the standard cryptographic signature of **RSA-2048 encryption**. 
Unlike M-Tix, which uses symmetric encryption (AES) where the client and server share the exact same key to both encrypt and decrypt, TIX ID uses state-of-the-art **Asymmetric Encryption**.

### How it works:
1. The Flutter client (`app.tix.id`) has a **Public Key** hardcoded into its `main.dart.js` compiled bundle.
2. The client uses this Public Key to encrypt the user's plaintext password.
3. The encrypted payload is sent over the network.
4. The server (`api-b2b.tix.id`) receives the payload and decrypts it using a highly secured **Private Key** that is never transmitted to the client.

**Conclusion on Decryption:**
Because TIX ID uses RSA, **it is cryptographically impossible to decrypt the intercepted password payload** without compromising the server to obtain the Private Key. 

## 3. The Pre-Flight "Guest" Token (Anti-Replay Mechanism)

If you attempt to execute the exact same `login` curl request a few hours later, you will receive:
```json
{
    "success": false,
    "error": {
        "code": "EXPIRED_TOKEN",
        "title": "Failed",
        "message": "Expired authentication token"
    }
}
```

This happens because TIX ID requires an `authorization: Bearer` header **even during the login request itself**. By decoding the JWT payload sent in the login headers, we found:

```json
{
  "iss": "tix-b2b",
  "sub": "Mobile authorization token",
  "purpose": "guest",
  "exp": 1771946207,
  "iat": 1771944407
}
```

The difference between `exp` (Expiry) and `iat` (Issued At) is exactly **1800 seconds (30 minutes)**. 
When the TIX ID website first loads, it generates this temporary 30-minute "Guest" token. The backend will instantly reject any `/login` request if the Guest Token attached to it is older than 30 minutes, acting as a strict anti-bot and anti-replay protection mechanism!

### Fetching the Guest Token Organically
Thanks to network interception, we discovered exactly how the Flutter application asks the server for this 30-minute Guest token. 

Before hitting `/v1/users/login`, the client must send a completely unauthenticated request to the Authorization endpoint:

**Request:**
`POST https://api-b2b.tix.id/v1/auth`
```json
{
  "client_id": "tixid_guest",
  "auth_code": null
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "expires_in": 30
    }
}
```

By adding this exact `POST /v1/auth` request to our scraper script, we can dynamically intercept a fresh 30-minute `"token"`, inject it as the `Authorization: Bearer <token>` header, and then safely proceed with the RSA-encrypted `/v1/users/login` attempt.

## 4. The Public Key & Future Automation

While we cannot decrypt *existing* payloads, we *can* find the Public Key to automate future logins programmatically.

By downloading the compiled Flutter web chunk (`main.dart.js`) and searching for standard PKCS#8 ASN.1 headers (`MIIBI`), we successfully extracted TIX ID's hardcoded RSA Public Key:

```text
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxa7lTKcbiczCEiOQQE13lc406wrBD29/5O0JKkhNB7bvZK5OzEH0zsje/V3WsK62bcThGqnrrSMCiAQOlIa1rEe2Ukp8UXjw/236vtfE0sAGz9W562G1R6LApkGyYaGdA9z56oGESB9mU4WFJx+AbWKhWcbAP/Qr6PAOABYxQYCIwvc2F9sNYPNcWluCNB8sLxLoC4rU5n2W4xuNYCkjhQbZrHkzMnvYs3b4+RqffMIvuk9wJ0QLLBxsWa1wnk07Bgl+ro2yriFskch7J4CFd5fCRQdR9JW7nzfsnz+VS1CXamSuWj3S+6cXIlxSmc3sQ4GzbfdgGervGXdc72FYuQIDAQAB
-----END PUBLIC KEY-----
```

### Automation Proof of Concept
We wrote a Node.js script (`test-rsa.js`) utilizing the native `crypto` library. By combining our plaintext password with the extracted PEM key using `RSA_PKCS1_PADDING`, we can generate valid, 344-character Base64 encrypted payloads that the TIX ID backend will happily accept.

This means that if we want to migrate away from the Playwright browser-based scraper to a pure API-based scraper for TIX ID, we now possess the cryptographic key necessary to automate the user login handshake and acquire fresh `Bearer` tokens organically.
