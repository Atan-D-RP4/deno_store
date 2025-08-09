"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import React from "react";
import Container from "@/components/layout/Container.tsx";
import Button from "@/components/ui/Button.tsx";
import Input from "@/components/ui/Input.tsx";
import Alert from "@/components/ui/Alert.tsx";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<
    { message: string; type: "error" | "success" } | null
  >(null);
  const { login, register } = useAuth();
  const router = useRouter();

  const showAlert = (message: string, type: "error" | "success" = "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      await login(username, password);
      showAlert("Login successful! Redirecting...", "success");
      setTimeout(() => router.push("/dashboard"), 1000);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await register(username, email, password);
      showAlert("Registration successful! You can now sign in.", "success");
      setTimeout(() => {
        setActiveTab("signin");
        const loginForm = document.getElementById(
          "login-form",
        ) as HTMLFormElement;
        if (loginForm) {
          (loginForm.querySelector(
            'input[name="username"]',
          ) as HTMLInputElement).value = username;
        }
      }, 1500);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-5">
      <Container>
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 shadow-2xl w-full max-w-md border border-white/20 mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-gray-800 text-3xl font-semibold mb-2">
              Welcome
            </h1>
            <p className="text-gray-600 text-sm">
              Sign in to access your secure dashboard
            </p>
          </div>

          <div className="flex mb-8 bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              className={`flex-1 p-3 text-center rounded-lg cursor-pointer transition-all duration-300 font-medium ${
                activeTab === "signin"
                  ? "bg-white text-gray-800 shadow-md"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 p-3 text-center rounded-lg cursor-pointer transition-all duration-300 font-medium ${
                activeTab === "signup"
                  ? "bg-white text-gray-800 shadow-md"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("signup")}
            >
              Sign Up
            </button>
          </div>

          {alert && (
            <Alert type={alert.type} className="mb-5 text-sm">
              {alert.message}
            </Alert>
          )}

          {activeTab === "signin"
            ? (
              <form
                id="login-form"
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="login-username"
                    className="block mb-2 text-gray-800 font-medium text-sm"
                  >
                    Username
                  </label>
                  <Input
                    type="text"
                    id="login-username"
                    name="username"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="login-password"
                    className="block mb-2 text-gray-800 font-medium text-sm"
                  >
                    Password
                  </label>
                  <Input
                    type="password"
                    id="login-password"
                    name="password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full mb-5"
                >
                  {loading
                    ? (
                      <span className="inline-block w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    )
                    : "Sign In"}
                </Button>
              </form>
            )
            : (
              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label
                    htmlFor="register-username"
                    className="block mb-2 text-gray-800 font-medium text-sm"
                  >
                    Username
                  </label>
                  <Input
                    type="text"
                    id="register-username"
                    name="username"
                    required
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div>
                  <label
                    htmlFor="register-email"
                    className="block mb-2 text-gray-800 font-medium text-sm"
                  >
                    Email
                  </label>
                  <Input
                    type="email"
                    id="register-email"
                    name="email"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="register-password"
                    className="block mb-2 text-gray-800 font-medium text-sm"
                  >
                    Password
                  </label>
                  <Input
                    type="password"
                    id="register-password"
                    name="password"
                    required
                    minLength={6}
                    maxLength={100}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full mb-5"
                >
                  {loading
                    ? (
                      <span className="inline-block w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    )
                    : "Sign Up"}
                </Button>
              </form>
            )}
        </div>
      </Container>
    </div>
  );
}
