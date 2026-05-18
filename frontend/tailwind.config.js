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
                    dark: '#020B18',
                    surface: 'rgba(255,255,255,0.04)',
                    primary: '#00D97E',
                    blue: '#0EA5E9',
                }
            },
            animation: {
                'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                'glow-pulse': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(0,217,126,0.1)' },
                    '50%': { boxShadow: '0 0 40px rgba(0,217,126,0.25)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            }
        },
    },
    plugins: [],
}
