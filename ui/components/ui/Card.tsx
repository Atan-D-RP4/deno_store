"use client";

import React from "react";

export function Card(
  { className = "", children }: {
    className?: string;
    children: React.ReactNode;
  },
) {
  return (
    <div
      className={`bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader(
  { className = "", children }: {
    className?: string;
    children: React.ReactNode;
  },
) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle(
  { className = "", children }: {
    className?: string;
    children: React.ReactNode;
  },
) {
  return (
    <h3 className={`text-xl font-semibold text-gray-800 ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription(
  { className = "", children }: {
    className?: string;
    children: React.ReactNode;
  },
) {
  return <p className={`text-gray-600 ${className}`}>{children}</p>;
}

export function CardFooter(
  { className = "", children }: {
    className?: string;
    children: React.ReactNode;
  },
) {
  return <div className={`mt-4 ${className}`}>{children}</div>;
}
