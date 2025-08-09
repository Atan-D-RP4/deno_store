import React from "react";
import Link from "next/link";
import Container from "./Container.tsx";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/10 bg-white/80">
      <Container className="py-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-600">
          © {new Date().getFullYear()} Deno Store. All rights reserved.
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/products" className="hover:text-blue-600">Products</Link>
          <Link href="/orders" className="hover:text-blue-600">Orders</Link>
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
