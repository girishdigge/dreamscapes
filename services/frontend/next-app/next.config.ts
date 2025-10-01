// next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three'],
  webpack: (config: any) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    });
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${
          process.env.API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:8000'
        }/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

// // tailwind.config.js
// /** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: [
//     './pages/**/*.{js,ts,jsx,tsx,mdx}',
//     './components/**/*.{js,ts,jsx,tsx,mdx}',
//     './app/**/*.{js,ts,jsx,tsx,mdx}',
//   ],
//   theme: {
//     extend: {
//       animation: {
//         float: 'float 6s ease-in-out infinite',
//         glow: 'glow 2s ease-in-out infinite alternate',
//       },
//       keyframes: {
//         float: {
//           '0%, 100%': { transform: 'translateY(0px)' },
//           '50%': { transform: 'translateY(-10px)' },
//         },
//         glow: {
//           '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
//           '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
//         },
//       },
//     },
//   },
//   plugins: [],
// };

// // postcss.config.js
// module.exports = {
//   plugins: {
//     tailwindcss: {},
//     autoprefixer: {},
//   },
// };

// // app/layout.js
// import './globals.css';

// export const metadata = {
//   title: 'Dreamscapes - Interactive Dream Films',
//   description: 'Transform your dreams into interactive 3D films using AI',
//   viewport: 'width=device-width, initial-scale=1',
//   themeColor: '#0f1419',
// };
