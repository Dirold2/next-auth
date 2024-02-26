/** @type {import("next").NextConfig} */

const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '6dph3blg-3000.euw.devtunnels.ms',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '**',
      }
    ],
  },
  webpack: (config, options) => {
    return config;
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '6dph3blg-3000.euw.devtunnels.ms',
      ],
    },
  },
}

module.exports = nextConfig