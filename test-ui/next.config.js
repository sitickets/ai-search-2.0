/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for serverless deployment
  // Note: API calls go directly to serverless offline (no rewrite needed)
  // Set NEXT_PUBLIC_API_URL in .env.local if different from http://localhost:4000
}

module.exports = nextConfig

