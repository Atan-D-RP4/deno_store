"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Hero from "@/components/ui/Hero.tsx";

export default function IndexPage() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!user) router.push("/login");
    else router.push("/dashboard");
  }, [user, router]);

  // Show a quick landing hero while deciding
  return <Hero />;
}
