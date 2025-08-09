"use client";

import React from "react";
import Link from "next/link";
import Button from "./Button.tsx";
import { Card } from "./Card.tsx";

import type { Product } from "../../../schema.ts";

export default function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (id: number) => void;
}) {
  return (
    <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="h-48 bg-gray-100 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
        {product.image_url
          ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          )
          : <div className="text-gray-400 text-6xl">📦</div>}
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        {product.name}
      </h2>
      <p className="text-gray-600 mb-3 line-clamp-2">{product.description}</p>
      <p className="text-2xl font-bold text-indigo-600 mb-1">
        ${product.price}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Stock: {product.stock_quantity}
      </p>

      <div className="flex gap-2">
        <Button
          onClick={() => onAddToCart(product.id)}
          disabled={product.stock_quantity === 0}
        >
          {product.stock_quantity === 0 ? "Out of Stock" : "Add to Cart"}
        </Button>
        <Link href={`/product/${product.id}`} className="flex-1">
          <Button variant="secondary" className="w-full">Details</Button>
        </Link>
      </div>
    </Card>
  );
}
