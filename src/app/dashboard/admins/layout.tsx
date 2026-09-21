import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admins",
};

export default function AdminsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
