/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                leaf: {
                    50: "#fffbf0",
                    100: "#fef3c7",
                    400: "#ffd814",
                    500: "#ff9900",
                    600: "#e47911",
                    700: "#cc6600",
                    900: "#804000",
                },
                ink: {
                    800: "#232f3e",
                    900: "#19222d",
                    950: "#0f1111",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
};