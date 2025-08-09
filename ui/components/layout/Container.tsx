"use client";

import React from "react";

export default function Container({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`max-w-6xl mx-auto px-5 ${className}`}>{children}
  </div>;
}
