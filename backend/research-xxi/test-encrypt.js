const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const fs = require("fs");
const { execSync } = require("child_process");

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

function encryptSecret(bodyString) {
    const keyStr = "567G553Yz6r6Du24Ln9TRPpWe6wGSZ2T";
    return CryptoJS.AES.encrypt(bodyString, keyStr).toString();
}

const creds = fs.readFileSync("creds.txt", "utf8");
const phone_number = creds.match(/phone_number:\s*(.+)/)[1].trim();
const pin = creds.match(/pin:\s*(.+)/)[1].trim();

const mpin = encryptPin(pin);
const rawPayload = JSON.stringify({
    msisdn: phone_number,
    mpin: mpin
});

console.log("JSON Body before secret mapping:", rawPayload);

const secret = encryptSecret(rawPayload);
const encryptedSecretJson = JSON.stringify({ secret });
console.log("Final Secret payload:");
console.log(encryptedSecretJson);

const curlCommand = `
curl 'https://m.21cineplex.com/api/user?type=Login' \\
  -H 'accept: */*' \\
  -H 'accept-language: en,zh-CN;q=0.9,zh;q=0.8,id;q=0.7' \\
  -H 'content-type: application/json' \\
  -b '_ga_B87QWNSGB3=deleted; _ga=GA1.1.411094583.1765412531; X-DEVICE-UIID=a57ab5bc-9c4a-401f-8e37-2a1a90750aee; X-FINGERPRINT-DATA=U2FsdGVkX1+UjBdXyAAwkKR8YZOm51yW4waCHqCyM0lNALnlyfe35wyd/bAkTyAqDqMUTW0ygkszX+TauP+fBIowmZSn+FhxKYw8tYUvKQ4uhLdAj/VOxj3UIVnlArFlYHJfqwKhlbM/Oes68Umvdwpf3kqgpsmBj4FswCVVeJQU2J+fLCKoeYr2yhlkjfN0j5HGx5FfCF5bqql9930NVf/vNHIPQ+a2in/pcRYlf0/K7QGW6FZZ0bnQPmhDBbn035x5YhRmh9dKqhaDYD90HqDj6RvtDnbEqydRug9IskDaha2IqS7q4btMNfkmrRRayQYgV80Xiq25MD6trsbctBDCxKHXBK9azXz2fCVBI6h5Z0pJzLGi88X91aylUXvhmHvow59QPaQPOl3PqN5ytfhjB4rkN7+CnxZ3kLuHdnS8ezqhMclEaahCvYOaLc/xHEFUDVQj1bg7HMdS3aM+JU+QmYBdEnaXKVFQa0AAI1I=; NEXT_LOCALE=id; __Host-next-auth.csrf-token=ff73abfacfffe730746e61974a4a8106285a2f3a96905875c5269d28f7a1de41%7C4751bd09a22af17ef742e6ac67bea60ddfa82d00ec464dfdd4e01547c031cc95; MTIX_WEB_SESSID=ar3nb5m47g5gv5lmbp07ajutg1; MTIX-WEB=MTIXWEB01; mtix-city_id=10; _ga_B87QWNSGB3=GS2.1.s1771927998$o13$g1$t1771928021$j37$l0$h0; __Secure-next-auth.callback-url=https%3A%2F%2Fm.21cineplex.com%2Fauth%2Flogin' \\
  -H 'dnt: 1' \\
  -H 'origin: https://m.21cineplex.com' \\
  -H 'priority: u=1, i' \\
  -H 'referer: https://m.21cineplex.com/id/auth/login' \\
  -H 'sec-ch-ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"' \\
  -H 'sec-ch-ua-mobile: ?0' \\
  -H 'sec-ch-ua-platform: "macOS"' \\
  -H 'sec-fetch-dest: empty' \\
  -H 'sec-fetch-mode: cors' \\
  -H 'sec-fetch-site: same-origin' \\
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36' \\
  -H 'x-device-uiid: a57ab5bc-9c4a-401f-8e37-2a1a90750aee' \\
  -H 'x-fingerprint-data: U2FsdGVkX1+UjBdXyAAwkKR8YZOm51yW4waCHqCyM0lNALnlyfe35wyd/bAkTyAqDqMUTW0ygkszX+TauP+fBIowmZSn+FhxKYw8tYUvKQ4uhLdAj/VOxj3UIVnlArFlYHJfqwKhlbM/Oes68Umvdwpf3kqgpsmBj4FswCVVeJQU2J+fLCKoeYr2yhlkjfN0j5HGx5FfCF5bqql9930NVf/vNHIPQ+a2in/pcRYlf0/K7QGW6FZZ0bnQPmhDBbn035x5YhRmh9dKqhaDYD90HqDj6RvtDnbEqydRug9IskDaha2IqS7q4btMNfkmrRRayQYgV80Xiq25MD6trsbctBDCxKHXBK9azXz2fCVBI6h5Z0pJzLGi88X91aylUXvhmHvow59QPaQPOl3PqN5ytfhjB4rkN7+CnxZ3kLuHdnS8ezqhMclEaahCvYOaLc/xHEFUDVQj1bg7HMdS3aM+JU+QmYBdEnaXKVFQa0AAI1I=' \\
  -H 'x-language: id' \\
  --data-raw '${encryptedSecretJson}'
`;

console.log("Executing login...");
try {
    const result = execSync(curlCommand, { encoding: "utf8" });
    console.log("Login HTTP Response:", result);
} catch (e) {
    console.error("Login failed:", e.message);
    if (e.stdout) {
        console.log("Stdout:", e.stdout.toString());
    }
}
