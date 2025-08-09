"use client";

import React from "react";
import Container from "../layout/Container.tsx";
import Link from "next/link";
import Button from "./Button.tsx";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-slate-50 to-blue-100 border-b border-black/5">
      <Container className="py-16 grid gap-10 md:grid-cols-2 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Discover quality products at fair prices
          </h1>
          <p className="text-gray-600 mb-6">
            Modern storefront built with Next.js, Tailwind and Deno backend.
            Secure auth, smooth checkout.
          </p>
          <div className="flex gap-3">
            <Link href="/products">
              <Button>Shop now</Button>
            </Link>
            <Link href="/orders">
              <Button variant="secondary">Track orders</Button>
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="h-64 md:h-80 rounded-3xl bg-white shadow-xl border border-black/5 grid place-items-center text-7xl">
            🛍️
          </div>
          <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg px-4 py-2 border border-black/5 text-sm">
            Secure checkout 🔒
          </div>
        </div>
      </Container>
    </section>
  );
}
