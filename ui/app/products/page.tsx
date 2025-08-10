"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Link from "next/link";

import Container from "@/components/layout/Container.tsx";
import Spinner from "@/components/ui/Spinner.tsx";
import ProductCard from "@/components/ui/ProductCard.tsx";
import Button from "@/components/ui/Button.tsx";

import type { CartItem, Product } from "../../../schema.ts";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const result = await response.json();
        if (result.success) setProducts(result.data);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const addToCart = (productId: number) => {
    const updatedCart = [...cart];
    const existing = updatedCart.find((item) => item.productId === productId);
    if (existing) existing.quantity += 1;
    else updatedCart.push({ productId, quantity: 1 });

    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    alert("Added to cart!");
  };

  const getCartItemCount = () => cart.reduce((t, i) => t + i.quantity, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 grid place-items-center">
        <div className="text-center">
          <Spinner />
          <p className="text-gray-600 mt-4">Loading products...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <main className="mt-10">
        <Container>
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 mb-8 shadow-xl border border-white/20 text-center">
            <h1 className="text-4xl mb-2 text-gray-800 font-semibold">
              Products
            </h1>
            <p className="text-lg text-gray-600">
              Browse our collection of premium products
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </div>

          <div className="flex justify-center gap-4 mb-8 flex-wrap">
            <Link href="/cart">
              <Button variant="success" className="flex items-center gap-2">
                🛒 View Cart ({getCartItemCount()})
              </Button>
            </Link>
            <Link href="/orders">
              <Button variant="secondary">Order History</Button>
            </Link>
          </div>
        </Container>
      </main>
    </div>
  );
}
