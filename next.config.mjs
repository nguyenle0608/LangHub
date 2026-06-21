/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ hostname: '*.supabase.co' }],
  },
  experimental: {
    // Tree-shake barrel imports from these packages to shrink client bundles
    optimizePackageImports: [
      'lucide-react',
      'cmdk',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-slider',
      '@radix-ui/react-label',
    ],
  },
}

export default nextConfig
