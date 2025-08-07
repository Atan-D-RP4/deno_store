"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header.tsx";
import { useAuth } from "@/components/authContext.tsx";
import Link from "next/link";

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
      showAlert("Failed to refresh user data");
    }
  };

  const handleShowUserInfo = () => {
    if (user) {
      const info = `
User Information:
• Username: ${user.username}
• Email: ${user.email}
• User ID: ${user.id}
• Account Created: ${new Date(user.created_at).toLocaleString()}
• Session Duration: ${sessionTime}
      `;
      alert(info);
    }
  };

  const handleTestAPI = async () => {
    try {
      const response = await fetch("/api/me");
      const result = await response.json();

      if (result.success) {
        showAlert("API test successful! Your session is valid.", "success");
      } else {
        showAlert("API test failed. Session may be invalid.");
      }
    } catch (error) {
      showAlert("API test failed. Network error.");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <Header />

      <main className="max-w-6xl mx-auto mt-10 px-5">
        {alert && (
          <div
            className={`p-4 rounded-xl mb-5 ${
              alert.type === "error"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {alert.message}
          </div>
        )}

        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 mb-8 shadow-xl border border-white/20 text-center">
          <h1 className="text-4xl mb-4 text-gray-800 font-semibold">
            Welcome to Your Dashboard
          </h1>
          <p className="text-lg text-gray-600 mb-5">
            You have successfully authenticated and can now access the protected
            content.
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
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-gray-800 mb-4 text-xl font-semibold">
              🛡️ Security Status
            </h3>
            <p className="text-gray-600 leading-relaxed mb-5">
              Your session is secured with JWT tokens and server-side session
              management. All communications are protected.
            </p>
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
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-gray-800 mb-4 text-xl font-semibold">
              📊 Dashboard Features
            </h3>
            <p className="text-gray-600 leading-relaxed mb-5">
              This is a fully functional authentication system built with
              TypeScript, Deno, and modern security practices.
            </p>
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
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-gray-800 mb-4 text-xl font-semibold">
              ⚡ Performance
            </h3>
            <p className="text-gray-600 leading-relaxed mb-5">
              Built with Deno and Oak framework for optimal performance and
              security. Session management is handled efficiently.
            </p>
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
          </div>
        </div>

        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <button
            onClick={handleRefreshUserData}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/30"
          >
            Refresh Data
          </button>
          <button
            onClick={handleShowUserInfo}
            className="px-6 py-3 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            User Info
          </button>
          <button
            onClick={handleTestAPI}
            className="px-6 py-3 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            Test API
          </button>
          <Link
            href="/products"
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/30"
          >
            Browse Products
          </Link>
        </div>
      </main>
    </div>
  );
}
