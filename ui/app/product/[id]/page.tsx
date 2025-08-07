"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Header from "@/components/header.tsx";
import Link from "next/link";

import type { Product, CartItem } from "../../../../schema.ts";

export default function ProductDetailPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

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
    const fetchProduct = async () => {
      if (!productId) return;

      try {
        const response = await fetch(`/api/products/${productId}`);
        const result = await response.json();
        if (result.success) {
          setProduct(result.data);
        } else {
          console.error("Product not found");
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <main className="max-w-6xl mx-auto mt-10 px-5">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 shadow-xl border border-white/20 text-center">
            <h1 className="text-4xl mb-4 text-gray-800 font-semibold">
              Product Not Found
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              The product you're looking for doesn't exist.
            </p>
            <Link
              href="/products"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/30"
            >
              Back to Products
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <Header />

      <main className="max-w-6xl mx-auto mt-10 px-5">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 mb-8 shadow-xl border border-white/20 text-center">
          <h1 className="text-4xl mb-4 text-gray-800 font-semibold">
            {product.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product Image */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center">
              {product.image_url
                ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                )
                : <div className="text-gray-400 text-8xl">📦</div>}
            </div>
          </div>

          {/* Product Details */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                {product.name}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                {product.description}
              </p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-indigo-600">
                  ${product.price}
                </span>
              </div>

              <div className="mb-6">
                <span className="text-sm text-gray-500">Stock Available:</span>
                <span
                  className={`font-medium ${
                    product.stock_quantity > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {product.stock_quantity > 0
                    ? `${product.stock_quantity} units`
                    : "Out of Stock"}
                </span>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => addToCart(product.id)}
                disabled={product.stock_quantity === 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {product.stock_quantity === 0 ? "Out of Stock" : "Add to Cart"}
              </button>
            </div>

            <div className="flex gap-4">
              <Link
                href="/products"
                className="flex-1 px-6 py-3 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg text-center"
              >
                Back to Products
              </Link>
              <Link
                href="/cart"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/30 text-center"
              >
                View Cart
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Product Info */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Product Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl mb-2">🚚</div>
              <div className="font-medium text-gray-800">Free Shipping</div>
              <div className="text-sm text-gray-600">On orders over $50</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl mb-2">🔒</div>
              <div className="font-medium text-gray-800">Secure Payment</div>
              <div className="text-sm text-gray-600">
                256-bit SSL encryption
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl mb-2">↩️</div>
              <div className="font-medium text-gray-800">Easy Returns</div>
              <div className="text-sm text-gray-600">30-day return policy</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
