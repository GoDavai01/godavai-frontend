import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function Refunds() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <Navbar />
      <div className="px-4 pt-4">
        <Button variant="ghost" className="btn-ghost-soft !font-bold mb-2" onClick={() => navigate(-1)}>
          ← Back
        </Button>

        <h1 className="text-[20px] font-extrabold" style={{ color: DEEP }}>
          Refunds &amp; Cancellations
        </h1>
        <div className="text-xs text-slate-500 mt-1">Last updated: 5 September 2025</div>

        <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-slate-800">
          <p>
            We currently <b>do not offer refunds or cancellations</b> once an order has been placed,
            except where required by applicable law.
          </p>
          <p>
            For any concerns with a delivered order (e.g., damage, missing items, or legal non-compliance),
            please contact us within 48 hours:
          </p>
          <ul className="list-disc pl-5">
            <li>Support: <b>info@godavaii.com</b></li>
            <li>Grievance: <b>grievance@godavaii.com</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
