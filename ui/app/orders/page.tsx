"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/authContext.tsx";
import Header from "@/components/header.tsx";
import Link from "next/link";

import type { Order, OrderItem } from "../../../schema.ts";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        const result = await response.json();
        if (result.success) {
          setOrders(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "shipped":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
        <Header />
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue -100">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Your Orders</h1>
        {orders.length === 0
          ? <p className="text-gray-600">You have no orders yet.</p>
          : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-6 bg-white shadow-sm"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Order #{order.id}</h2>
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded ${
                        getStatusColor(order.status)
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-gray-500 mb-2">
                    Placed on {formatDate(order.createdAt)}
                  </p>
                  <ul className="space-y-4">
                    {order.items.map((item: OrderItem) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.product.name} (x{item.quantity})</span>
                        <span>${item.product.price.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t pt-4">
                    <p className="text-gray-700 font-semibold">
                      Total: ${order.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        <Link
          href="/"
          className="mt-6 inline-block text-blue-600 hover:underline"
        >
          Back to Products
        </Link>
      </div>
    </div>
  );
}
