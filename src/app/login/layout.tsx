import type { Metadata } from "next";

// Client components cannot export metadata; the title lives on this server
// layout, per the App Router convention in this Next version.
export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
