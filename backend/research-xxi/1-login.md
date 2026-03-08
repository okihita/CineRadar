# M-Tix Login Bypass & Encryption Mechanisms

Through reverse-engineering the Next.js client bundles for `m.21cineplex.com`, the client-side encryption used to protect user credentials has been fully bypassed. We can now programmatically log in and obtain valid JWT tokens without needing a browser.

## Encryption Implementation

The API expects the `mpin` to be AES-256-CBC encrypted, and then the entire JSON body to be encrypted again using CryptoJS AES. 

Two distinct hardcoded symmetric keys are used in the process:

1. **PIN Encryption Key**: `zJK6Y7XKDUVvc76xLyyvKgGBGFV6mGMW`
2. **Payload/Secret Encryption Key**: `567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T`

### Step 1: Encrypting the PIN
The `mpin` field must be encrypted using standard AES-256-CBC.
- **Algorithm**: `aes-256-cbc`
- **Key**: `zJK6Y7XKDUVvc76xLyyvKgGBGFV6mGMW`
- **IV**: 16 bytes, randomly generated per request
- **Output Format**: Base64 encoded string consisting of `[IV_BYTES] + [CIPHERTEXT_BYTES]`.

### Step 2: Encrypting the Payload
The entire JSON payload containing the `msisdn` (phone number) and the newly encrypted `mpin` must be stringified and encrypted.
- **Algorithm**: CryptoJS AES (which uses OpenSSL-compatible `Salted__` format)
- **Key**: `567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T`
- **Output Format**: A Base64 string that always starts with `U2FsdGVkX1` (`Salted__`).

## Proof of Concept Script

A fully functioning Proof of Concept (PoC) script has been written in `encrypt.js`. 

```javascript
const crypto = require("crypto");
const CryptoJS = require("crypto-js");

// 1. Encrypt the PIN
function encryptPin(pin) {
  const keyStr = "zJK6Y7XKDUVvc76xLyyvKgGBGFV6mGMW";
  const key = Buffer.from(keyStr);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const input = Buffer.from(pin);
  let d = cipher.update(input);
  d = Buffer.concat([iv, d, cipher.final()]);
  return d.toString("base64");
}

// 2. Encrypt the entire Payload
function encryptSecret(bodyString) {
  const keyStr = "567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T";
  return CryptoJS.AES.encrypt(bodyString, keyStr).toString();
}

// Example Usage
const mpin = encryptPin("123456");
const rawPayload = JSON.stringify({
  msisdn: "081234567890",
  mpin: mpin
});

const secret = encryptSecret(rawPayload);
console.log(JSON.stringify({ secret }));
```

By sending this `{"secret": "..."}` payload to the `/api/user?type=Login` endpoint via a standard curl request, the server responds with a `200 OK` and the valid user session tokens. Device fingerprint headers exist but are not strictly validated for the login to succeed.
