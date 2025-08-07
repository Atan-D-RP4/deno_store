"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Header from "@/components/header.tsx";
import Link from "next/link";

import type { CartItem } from "../../../schema.ts";

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadCart = async () => {
      const savedCart = localStorage.getItem("cart");
      if (!savedCart) {
        setLoading(false);
        return;
      }

      const cart: CartItem[] = JSON.parse(savedCart);
      const itemsWithProducts: CartItem[] = [];

      for (const item of cart) {
        try {
          const response = await fetch(`/api/products/${item.productId}`);
          const result = await response.json();
          if (result.success) {
            itemsWithProducts.push({
              ...item,
              product: result.data,
            });
          }
        } catch (error) {
          console.error("Failed to fetch product:", error);
        }
      }

      setCartItems(itemsWithProducts);
      setLoading(false);
    };

    loadCart();
  }, []);

  const removeFromCart = (productId: number) => {
    const updatedItems = cartItems.filter((item) =>
      item.productId !== productId
    );
    setCartItems(updatedItems);

    const cartData = updatedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    localStorage.setItem("cart", JSON.stringify(cartData));
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const updatedItems = cartItems.map((item) =>
      item.productId === productId ? { ...item, quantity: newQuantity } : item
    );
    setCartItems(updatedItems);

    const cartData = updatedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    localStorage.setItem("cart", JSON.stringify(cartData));
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.product?.price || 0) * item.quantity;
    }, 0).toFixed(2);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const checkout = async () => {
    if (cartItems.length === 0) {
      alert("Cart is empty");
      return;
    }

    setCheckingOut(true);
    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: orderItems }),
      });

      const result = await response.json();
      if (result.success) {
        alert("Order placed successfully!");
        localStorage.removeItem("cart");
        router.push("/orders");
      } else {
        alert("Failed to place order: " + result.error);
      }
    } catch (error) {
      alert("Failed to place order. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Loading cart...</p>
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
            Shopping Cart
          </h1>
          <p className="text-lg text-gray-600">
            {cartItems.length > 0
              ? `${getTotalItems()} items in your cart`
              : "Your cart is empty"}
          </p>
        </div>

        {cartItems.length === 0
          ? (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-white/20 text-center">
              <div className="text-8xl mb-6">🛒</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Your cart is empty
              </h2>
              <p className="text-gray-600 mb-6">
                Looks like you haven't added any items to your cart yet.
              </p>
              <Link
                href="/products"
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/30"
              >
                Start Shopping
              </Link>
            </div>
          )
          : (
            <>
              <div className="space-y-4 mb-8">
                {cartItems.map((item) => (
                  <div
                    key={item.productId}
                    className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 flex items-center gap-6"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {item.product?.image_url
                        ? (
                          <img
                            src={item.product.image_url}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        )
                        : <div className="text-gray-400 text-2xl">📦</div>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-gray-800 mb-1">
                        {item.product?.name || "Unknown Product"}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                        {item.product?.description || ""}
                      </p>
                      <p className="text-lg font-bold text-indigo-600">
                        ${item.product?.price || 0}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 font-bold transition-colors"
                      >
                        −
                      </button>
                      <span className="w-12 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-800 mb-1">
                        ${((item.product?.price || 0) * item.quantity).toFixed(
                          2,
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Summary */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-semibold text-gray-800">
                    Total:
                  </span>
                  <span className="text-3xl font-bold text-indigo-600">
                    ${getTotalPrice()}
                  </span>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={checkout}
                    disabled={checkingOut}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-none rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {checkingOut
                      ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </span>
                      )
                      : (
                        "Proceed to Checkout"
                      )}
                  </button>
                  <Link
                    href="/products"
                    className="px-6 py-3 bg-white/80 text-gray-800 border border-gray-200 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-lg text-center"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </>
          )}
      </main>
    </div>
  );
}
