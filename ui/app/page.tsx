"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import React from "react";

// Index page for the application
// Route to this page is /
// Route to login page is /login
// if user is logged in, redirect to /dashboard
export default function IndexPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if user is logged in
  React.useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);
  // else redirect to login page
  React.useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);
}
