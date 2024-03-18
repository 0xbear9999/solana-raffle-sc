import type { Config } from "tailwindcss"
const { nextui } = require("@nextui-org/react")

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",

  plugins: [
    nextui({
      themes: {
        "main-theme": {
          extend: "dark",
          colors: {
            primary: {
              foreground: "#000000",
              DEFAULT: "#59e6c3",
            },
            secondary: "#0BFFD0",
          },
        },
      },
    }),
  ],
} satisfies Config
