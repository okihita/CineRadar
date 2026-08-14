import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: {
        version: "19.0",
      },
    },
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          allowedStrings: [
            "🎬", "🍿", "🔥", "🟢", "📍", "🏢", "🎟️", "🎭", "💰", "📈", "🌅", "☀️", "🌆", "🌙", "✨", "🧠", "📜", "🏕️", "⚽", "🎵", "👨‍👩‍👧", "🕵️", "🎨", "🚀", "🔪", "🧙", "🧗", "😂", "👻", "💥",
            "📊", "🏆", "🏙️", "⏰", "📅", "🕒", "🗺️", "👤", "🕐",
            "•", ":", "/", "-", "—", "–", "|", "▼", "▲", "(", ")", ",", "%", "...", "x", "X", "+", "1-10", "11-30", "30+", "10:00–23:00"
          ],
          ignoreProps: true,
          noAttributeStrings: false,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
