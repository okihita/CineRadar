import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const noXsFontPlugin = {
  rules: {
    "no-xs-font": {
      meta: {
        type: "problem",
        docs: {
          description: "Ban text-xs and sub-14px font classes project wide",
        },
        fixable: "code",
        messages: {
          forbiddenFont:
            "Do not use '{{className}}' or sub-14px font classes. Use 'text-sm' or higher instead for readability.",
        },
      },
      create(context) {
        const FORBIDDEN_REGEX = /\b(text-xs|text-\[(?:[1-9]|1[0-2])px\])\b/g;

        function checkString(node, text) {
          if (typeof text !== "string") return;
          let match;
          while ((match = FORBIDDEN_REGEX.exec(text)) !== null) {
            const forbiddenClass = match[0];
            context.report({
              node,
              messageId: "forbiddenFont",
              data: {
                className: forbiddenClass,
              },
              fix(fixer) {
                const escaped = forbiddenClass.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
                const replaced = text.replace(new RegExp(`\\b${escaped}\\b`, "g"), "text-sm");
                if (node.type === "Literal") {
                  return fixer.replaceText(node, JSON.stringify(replaced));
                }
                return null;
              },
            });
          }
        }

        return {
          Literal(node) {
            if (typeof node.value === "string") {
              checkString(node, node.value);
            }
          },
          TemplateElement(node) {
            if (typeof node.value?.raw === "string") {
              checkString(node, node.value.raw);
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      cineradar: noXsFontPlugin,
    },
    rules: {
      "cineradar/no-xs-font": "error",
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
    settings: {
      react: {
        version: "19.0",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "eslint.config.mjs",
  ]),
]);

export default eslintConfig;
