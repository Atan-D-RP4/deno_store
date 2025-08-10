"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/authContext.tsx";

import Container from "@/components/layout/Container.tsx";
import Spinner from "@/components/ui/Spinner.tsx";
import { Card } from "@/components/ui/Card.tsx";
import Badge from "@/components/ui/Badge.tsx";
import EmptyState from "@/components/ui/EmptyState.tsx";

import type { Order, OrderItem, Product } from "../../../schema.ts";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [productMap, setProductMap] = useState<Record<number, Product>>({});
  const [productsLoading, setProductsLoading] = useState(false);
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
        const response = await fetch("/api/orders", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const result = await response.json();
        if (result.success) setOrders(result.data);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchOrders();
  }, [user]);

  // Fetch referenced products after orders load (client-side effect)
  useEffect(() => {
    const loadProducts = async () => {
      const ids = Array.from(
        new Set(
          orders.flatMap((o) => o.items.map((i) => i.product_id)),
        ),
      );
      if (ids.length === 0) return;

      setProductsLoading(true);
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const resp = await fetch(`/api/products/${id}`);
              const json = await resp.json();
              if (json?.success) return [id, json.data] as const;
            } catch (e) {
              console.error(`Failed to fetch product ${id}:`, e);
            }
            return null;
          }),
        );
        const map: Record<number, Product> = {};
        for (const entry of results) {
          if (entry) {
            const [id, prod] = entry;
            map[id] = prod as Product;
          }
        }
        setProductMap((prev) => ({ ...prev, ...map }));
      } finally {
        setProductsLoading(false);
      }
    };

    if (orders.length) loadProducts();
  }, [orders]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusToColor = (
    status: string,
  ): "yellow" | "blue" | "purple" | "green" | "red" | "gray" => {
    switch ((status || "").toLowerCase()) {
      case "pending":
        return "yellow";
      case "processing":
        return "blue";
      case "shipped":
        return "purple";
      case "delivered":
        return "green";
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 grid place-items-center">
        <div className="text-center">
          <Spinner />
          <p className="text-gray-600 mt-4">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <main className="mt-10">
        <Container>
          <h1 className="text-3xl font-bold mb-6">Your Orders</h1>
          {orders.length === 0
            ? (
              <EmptyState
                title="No orders yet"
                description="When you place an order it will appear here."
                actionHref="/products"
                actionText="Browse products"
                icon="📦"
              />
            )
            : (
              <div className="space-y-6">
                {orders.map((order) => (
                  <Card key={order.id} className="p-6">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-lg font-semibold">
                        Order #{order.id}
                      </h2>
                      <Badge color={statusToColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-gray-500 mb-2">
                      Placed on {formatDate(order.created_at)}
                    </p>
                    <ul className="space-y-2">
                      {order.items.map((item: OrderItem) => {
                        const product = productMap[item.product_id];
                        return (
                          <li
                            key={item.id}
                            className="flex justify-between text-sm"
                          >
                            <span>
                              {product
                                ? product.name
                                : productsLoading
                                ? "Loading…"
                                : "Unknown product"} ({item.quantity})
                            </span>
                            <span>
                              {product ? `${product.price}` : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-4 border-t pt-4">
                      <p className="text-gray-700 font-semibold">
                        Total: ${order.total_amount.toFixed(2)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          <Link
            href="/products"
            className="mt-6 inline-block text-blue-600 hover:underline"
          >
            Back to Products
          </Link>
        </Container>
      </main>
    </div>
  );
}
