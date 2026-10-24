/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the preview server aligned with the patched Next runtime.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
