"use client";

import React from "react";

export default function Badge({
  children,
  color = "gray",
  className = "",
}: {
  children: React.ReactNode;
  color?: "gray" | "yellow" | "blue" | "purple" | "green" | "red";
  className?: string;
}) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800 border-gray-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
    green: "bg-green-100 text-green-800 border-green-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`px-3 py-1 text-sm font-medium rounded border ${
        colors[color]
      } ${className}`}
    >
      {children}
    </span>
  );
}
