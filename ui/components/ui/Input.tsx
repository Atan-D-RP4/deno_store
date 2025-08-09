"use client";

import React from "react";

export default function Input(
  { className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      className={`w-full p-4 border-2 border-gray-200 rounded-xl text-base transition-all duration-300 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ${className}`}
      {...props}
    />
  );
}
