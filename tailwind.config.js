/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ['./src/**/*.{tsx,jsx}'],
    theme: {
        extend: {}
    },
    plugins: [require('@tailwindcss/typography')]
}
