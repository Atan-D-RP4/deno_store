"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Link from "next/link";

import Container from "@/components/layout/Container.tsx";
import Spinner from "@/components/ui/Spinner.tsx";
import Button from "@/components/ui/Button.tsx";
import Alert from "@/components/ui/Alert.tsx";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card.tsx";

export default function DashboardPage() {
  const [sessionTime, setSessionTime] = useState("0:00");
  const [alert, setAlert] = useState<
    { message: string; type: "error" | "success" } | null
  >(null);
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  const sessionStartTime = useState(() => Date.now())[0];

  const showAlert = (message: string, type: "error" | "success" = "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const updateSessionTime = () => {
    const elapsed = Date.now() - sessionStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    setSessionTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
  };

  const handleRefreshUserData = async () => {
    try {
      await refreshUser();
      showAlert("User data refreshed successfully!", "success");
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      showAlert("Failed to refresh user data");
    }
  };

  const handleShowUserInfo = () => {
    if (user) {
      const info =
        `\nUser Information:\n• Username: ${user.username}\n• Email: ${user.email}\n• User ID: ${user.id}\n• Account Created: ${
          new Date(user.created_at).toLocaleString()
        }\n• Session Duration: ${sessionTime}\n      `;
      globalThis.window.alert(info);
    }
  };

  const handleTestAPI = async () => {
    try {
      const response = await fetch("/api/me", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (result.success) {
        showAlert("API test successful! Your session is valid.", "success");
      } else showAlert("API test failed. Session may be invalid.");
    } catch (error) {
      showAlert("API test failed. Network error.");
      console.error("API test error:", error);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const interval = setInterval(updateSessionTime, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 grid place-items-center">
        <div className="text-center">
          <Spinner />
          <p className="text-gray-600 mt-4">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <main className="mt-10">
        <Container>
          {alert && (
            <Alert type={alert.type} className="mb-5">{alert.message}</Alert>
          )}

          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 mb-8 shadow-xl border border-white/20 text-center">
            <h1 className="text-4xl mb-4 text-gray-800 font-semibold">
              Welcome to Your Dashboard
            </h1>
            <p className="text-lg text-gray-600 mb-5">
              You have successfully authenticated and can now access the
              protected content.
            </p>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <span className="text-2xl font-bold text-gray-800 block">
                  {sessionTime}
                </span>
                <span className="text-xs text-gray-600 uppercase tracking-wider">
                  Session Time
                </span>
              </div>
              <div className="text-center">
                <span className="text-2xl block">🔒</span>
                <span className="text-xs text-gray-600 uppercase tracking-wider">
                  Secure
                </span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-gray-800 block">
                  {user.email}
                </span>
                <span className="text-xs text-gray-600 uppercase tracking-wider">
                  Email
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <CardHeader>
                <CardTitle>🛡️ Security Status</CardTitle>
              </CardHeader>
              <CardDescription className="mb-4">
                Your session is secured with JWT tokens and server-side session
                management. All communications are protected.
              </CardDescription>
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <span className="text-2xl block">✅</span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Protected
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-2xl block">🔐</span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Encrypted
                  </span>
                </div>
              </div>
            </Card>

            <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <CardHeader>
                <CardTitle>📊 Dashboard Features</CardTitle>
              </CardHeader>
              <CardDescription className="mb-4">
                This is a fully functional authentication system built with
                TypeScript, Deno, and modern security practices.
              </CardDescription>
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-800 block">
                    JWT
                  </span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Tokens
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-800 block">
                    SQLite
                  </span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Database
                  </span>
                </div>
              </div>
            </Card>

            <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <CardHeader>
                <CardTitle>⚡ Performance</CardTitle>
              </CardHeader>
              <CardDescription className="mb-4">
                Built with Deno and Oak framework for optimal performance and
                security. Session management is handled efficiently.
              </CardDescription>
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-800 block">
                    Fast
                  </span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Loading
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-xl font-bold text-gray-800 block">
                    Secure
                  </span>
                  <span className="text-xs text-gray-600 uppercase tracking-wider">
                    Sessions
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-center gap-4 mb-8 flex-wrap">
            <Button onClick={handleRefreshUserData}>Refresh Data</Button>
            <Button variant="secondary" onClick={handleShowUserInfo}>
              User Info
            </Button>
            <Button variant="secondary" onClick={handleTestAPI}>
              Test API
            </Button>
            <Link href="/products">
              <Button variant="success">Browse Products</Button>
            </Link>
          </div>
        </Container>
      </main>
    </div>
  );
}
