"use client";

import React from "react";
import Button from "./Button.tsx";
import Link from "next/link";

export default function EmptyState({
  title,
  description,
  actionHref,
  actionText,
  icon = "🛒",
}: {
  title: string;
  description: string;
  actionHref: string;
  actionText: string;
  icon?: string;
}) {
  return (
    <div className="text-center p-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
      <div className="text-7xl mb-4">{icon}</div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      <Link href={actionHref}>
        <Button>{actionText}</Button>
      </Link>
    </div>
  );
}
