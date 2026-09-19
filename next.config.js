/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'imgjam.com' },
      { protocol: 'https', hostname: 'freemusicarchive.org' },
      { protocol: 'https', hostname: '*.jamendo.com' },
    ],
  },
}

module.exports = nextConfig