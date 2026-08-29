import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mdxeditor/editor", "@gravatar-com/quick-editor"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gravatar.com",
        pathname: "/avatar/**",
      },
    ],
  },
};

export default nextConfig;
