/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    dark: '#0f111a',
                    darker: '#0a0c10',
                    primary: '#4f46e5', // indigo-600
                    secondary: '#9333ea', // purple-600
                }
            }
        },
    },
    plugins: [],
}
