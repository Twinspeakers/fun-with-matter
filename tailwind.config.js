module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,html}",
    "./js/**/*.js",
    "./wiki/**/*.md"
  ],
  // Your game toggles theme via: document.documentElement.dataset.theme = 'dark' | 'light'
  // So we treat [data-theme="dark"] as the "dark" selector.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
    }
  },
  plugins: []
};
