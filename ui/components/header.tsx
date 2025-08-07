"use client";

import Link from "next/link";
import { useAuth } from "@/components/authContext.tsx";

export default function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      globalThis.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-black/10 shadow-lg sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto flex justify-between items-center px-5 py-5">
        <Link
          href="/"
          className="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
        >
          🛒 Deno Store
        </Link>

        {user && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="font-semibold text-gray-800">{user.username}</div>
              <div className="text-xs text-gray-600">ID: {user.id}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white border-none rounded-lg cursor-pointer font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/30"
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
