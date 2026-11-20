"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Everything is on the Habits page now; old links and shortcuts land there. */
export default function TodayRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/habits"), [router]);
  return null;
}
