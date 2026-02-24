import base64
from typing import Any

from Cryptodome.Cipher import PKCS1_OAEP, PKCS1_v1_5
from Cryptodome.PublicKey import RSA

# The public key extracted from TIX ID's web app (main.dart.js)
PUB_KEY_B64 = (
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxa7lTKcbiczCEiOQQE13"
    "lc406wrBD29/5O0JKkhNB7bvZK5OzEH0zsje/V3WsK62bcThGqnrrSMCiAQOlIa1"
    "rEe2Ukp8UXjw/236vtfE0sAGz9W562G1R6LApkGyYaGdA9z56oGESB9mU4WFJx+A"
    "bWKhWcbAP/Qr6PAOABYxQYCIwvc2F9sNYPNcWluCNB8sLxLoC4rU5n2W4xuNYCkj"
    "hQbZrHkzMnvYs3b4+RqffMIvuk9wJ0QLLBxsWa1wnk07Bgl+ro2yriFskch7J4CF"
    "d5fCRQdR9JW7nzfsnz+VS1CXamSuWj3S+6cXIlxSmc3sQ4GzbfdgGervGXdc72FY"
    "uQIDAQAB"
)

def encrypt_password(password: str, use_oaep: bool = False) -> str:
    """
    Encrypts a plaintext password using TIX ID's public key.

    Args:
        password: The plaintext password.
        use_oaep: True to use OAEP padding, False to use PKCS#1 v1.5 padding.
                  Dart's pointycastle often uses PKCS#1 v1.5 by default for basic RSA,
                  but OAEP might be used. You can test both against the API.

    Returns:
        The Base64 encoded encrypted password string ready for the API payload.
    """
    pub_key_der = base64.b64decode(PUB_KEY_B64)
    pub_key = RSA.import_key(pub_key_der)

    message = password.encode('utf-8')

    if use_oaep:
        cipher: Any = PKCS1_OAEP.new(pub_key)
    else:
        cipher = PKCS1_v1_5.new(pub_key)

    encrypted_bytes = cipher.encrypt(message)
    return base64.b64encode(encrypted_bytes).decode('utf-8')

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Encrypt TIX ID Password")
    parser.add_argument("password", help="The plaintext password to encrypt")
    parser.add_argument("--oaep", action="store_true", help="Use OAEP padding instead of PKCS#1 v1.5")
    args = parser.parse_args()

    encrypted = encrypt_password(args.password, use_oaep=args.oaep)
