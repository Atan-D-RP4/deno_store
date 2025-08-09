"use client";

import React from "react";

export default function Alert({
  children,
  type = "info",
  className = "",
}: {
  children: React.ReactNode;
  type?: "info" | "success" | "error" | "warning";
  className?: string;
}) {
  const styles: Record<string, string> = {
    info: "bg-blue-50 text-blue-700 border border-blue-200",
    success: "bg-green-50 text-green-700 border border-green-200",
    error: "bg-red-50 text-red-700 border border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  };

  return (
    <div className={`p-3 rounded-lg ${styles[type]} ${className}`}>
      {children}
    </div>
  );
}
