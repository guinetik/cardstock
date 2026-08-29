import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The import dialogs post a zip through a server action, and an action body
  // is capped at 1 MB by default — under `MAX_UPLOAD_BYTES` the zip reader
  // enforces. 5mb leaves room for the multipart overhead on a 3 MB upload.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
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
