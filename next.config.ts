// @ts-check

/** @type {import('next').NextConfig} */

import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  // 프로젝트의 다른 Next.js 설정이 있다면 여기에 유지합니다.
};

export default withPWA(nextConfig);