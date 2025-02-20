module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'test-blue': {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        'test-gray': {
          light: '#F3F4F6',
          DEFAULT: '#6B7280',
          dark: '#4B5563'
        }
      },
      fontFamily: {
        'sans': ['Roboto', 'Arial', 'sans-serif']
      },
      borderRadius: {
        'large': '12px'
      }
    },
  },
  plugins: [],
}