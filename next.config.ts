import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ hostname: '*.supabase.co' }],
  },
}

export default nextConfig
