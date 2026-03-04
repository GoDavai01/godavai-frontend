// src/components/CartPage.js — 2035 Customer Cart (NO pharmacy selection)
import React from "react";
import { Button } from "../components/ui/button";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import CartBody from "./cart/CartBody";

export default function CartPage() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const handleClearCart = () => clearCart();
  const handleCheckout = () => navigate("/checkout");

  if (!cart.length) {
    return (
      <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center">
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: "rgba(0,217,126,0.08)",
            border: "1px solid rgba(0,217,126,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <ShoppingBag style={{ width: 36, height: 36, color: "#0C5A3E" }} />
        </div>

        <h2
          style={{
            fontFamily: "'Sora',sans-serif",
            fontSize: 22,
            fontWeight: 800,
            background: "linear-gradient(135deg, #0C5A3E, #00D97E)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}
        >
          Your cart is empty
        </h2>

        <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
          Add medicines to get started
        </p>

        <Button
          onClick={() => navigate("/medicines")}
          style={{
            borderRadius: 100,
            padding: "12px 28px",
            fontWeight: 700,
            fontSize: 14,
            background: "linear-gradient(135deg, #0C5A3E, #0E7A4F)",
            color: "#fff",
            boxShadow: "0 6px 20px rgba(12,90,62,0.30), 0 0 10px rgba(0,217,126,0.10)",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          Browse Medicines
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-4 mb-24 px-3">
      <h1
        style={{
          fontFamily: "'Sora',sans-serif",
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "-0.5px",
          background: "linear-gradient(135deg, #0C5A3E, #00D97E)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 14,
        }}
      >
        Cart
      </h1>

      <CartBody onClearCart={handleClearCart} onCheckout={handleCheckout} />
    </div>
  );
}