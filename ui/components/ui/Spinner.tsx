"use client";

import React from "react";

export default function Spinner(
  { size = 10, className = "" }: { size?: number; className?: string },
) {
  const border = Math.max(2, Math.floor(size / 5));
  return (
    <span
      className={`inline-block rounded-full animate-spin ${className}`}
      style={{
        width: `${size * 4}px`,
        height: `${size * 4}px`,
        borderWidth: `${border}px`,
        borderColor: "rgb(209 213 219)",
        borderTopColor: "rgb(79 70 229)",
      }}
    />
  );
}
