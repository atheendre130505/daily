"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Habits now live on Today; old links and shortcuts land there. */
export default function HabitsRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/today"), [router]);
  return null;
}
