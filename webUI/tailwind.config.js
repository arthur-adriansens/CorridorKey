/** @type {import('tailwindcss').Config} */

module.exports = {
    content: ["./**/*.html", "./**/*.js"],
    theme: {
        extend: {
            colors: {
                "corridor-bg": "#141300", // corridor crew website color
                "corridor-dark": "#0e0d00",
                "corridor-yellow": "#fff203",
                "corridor-blue": "#029AD4",
                "corridor-border": "#2f2f2f",
                success: "#20C985",
                warning: "#ec942cff",
                error: "#871919",
            },
        },
    },
    plugins: [],
};
