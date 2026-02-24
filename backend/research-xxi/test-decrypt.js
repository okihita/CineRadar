const CryptoJS = require("crypto-js");

function decryptSecret(encryptedBase64) {
    const keyStr = "567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T";
    const bytes = CryptoJS.AES.decrypt(encryptedBase64, keyStr);
    return bytes.toString(CryptoJS.enc.Utf8);
}

const encrypted = "U2FsdGVkX1/L14pBckLUIvkOkVNm1vFTJ9Kc5T8skE8H+sdpT14DDoUkun1PbS3SeszyOoxIxpriHphgS7uUXbZUvj29o25n65zeevnb6BCfO8HnXkydzVTX1x1VM6Xixv2oElfNTr5VJWz5NwPBFA==";
console.log(decryptSecret(encrypted));
