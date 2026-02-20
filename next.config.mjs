/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Prevent Next.js from walking up to a parent-directory lockfile.
    root: import.meta.dirname,
  },
};

export default nextConfig;
