"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Header from "@/components/header.tsx";
import Link from "next/link";

import type { Product, CartItem } from "../../../schema.ts";

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
    // Load cart from localStorage
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products");
        const result = await response.json();
        if (result.success) {
          setProducts(result.data);
        }
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

    if (existing) {
      existing.quantity += 1;
    } else {
      updatedCart.push({ productId, quantity: 1 });
    }

    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));

    // Show success message
    alert("Added to cart!");
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <Header />

      <main className="max-w-6xl mx-auto mt-10 px-5">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 mb-8 shadow-xl border border-white/20 text-center">
          <h1 className="text-4xl mb-4 text-gray-800 font-semibold">
            Products
          </h1>
          <p className="text-lg text-gray-600">
            Browse our collection of premium products
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="h-48 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
                {product.image_url
                  ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  )
                  : <div className="text-gray-400 text-6xl">📦</div>}
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {product.name}
              </h2>
              <p className="text-gray-600 mb-3 line-clamp-2">
                {product.description}
              </p>
              <p className="text-2xl font-bold text-indigo-600 mb-1">
                ${product.price}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Stock: {product.stock_quantity}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => addToCart(product.id)}
                  disabled={product.stock_quantity === 0}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {product.stock_quantity === 0
                    ? "Out of Stock"
                    : "Add to Cart"}
                </button>
                <Link
                  href={`/product/${product.id}`}
                  className="px-4 py-2 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg text-center"
                >
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4 mb-8 flex-wrap">
          <Link
            href="/cart"
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/30 flex items-center gap-2"
          >
            🛒 View Cart ({getCartItemCount()})
          </Link>
          <Link
            href="/orders"
            className="px-6 py-3 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            Order History
          </Link>
        </div>
      </main>
    </div>
  );
}
