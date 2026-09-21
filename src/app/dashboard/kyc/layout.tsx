import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KYC",
};

export default function KycLayout({ children }: { children: React.ReactNode }) {
  return children;
}
