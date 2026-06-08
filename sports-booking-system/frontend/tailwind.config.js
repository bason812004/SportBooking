/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15202b",
        field: "#f6f8fb",
        court: "#1f8a5b",
        line: "#d7dee8",
        action: "#2563eb"
      }
    }
  },
  plugins: []
};
