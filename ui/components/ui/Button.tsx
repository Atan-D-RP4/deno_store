"use client";

import React from "react";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30",
  secondary:
    "bg-white/80 text-gray-800 border border-gray-200 hover:-translate-y-0.5 hover:shadow-lg",
  success:
    "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30",
  danger:
    "bg-gradient-to-r from-red-500 to-rose-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
};

export default function Button({
  children,
  className = "",
  variant = "primary",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
        variants[variant]
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
