/** @type {import('tailwindcss').Config} */
import { baseTheme } from '@manhuaworks/ui/tailwind.base'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    // v2.0 design system tokens — DO NOT remove or override
    extend: baseTheme,

    // Dev Portal-specific extensions below this line
  },
  plugins: [],
}
