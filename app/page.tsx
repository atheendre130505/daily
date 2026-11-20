"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The site root just opens Habits (a static site can't redirect on the server). */
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace("/habits"), [router]);
  return null;
}
