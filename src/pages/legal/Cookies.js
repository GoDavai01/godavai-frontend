import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function Cookies() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <div className="px-4 pt-4">
        <Button variant="ghost" className="btn-ghost-soft !font-bold mb-2" onClick={() => navigate(-1)}>
          ← Back
        </Button>

        <h1 className="text-[20px] font-extrabold" style={{ color: DEEP }}>
          Cookie &amp; Tracking Notice
        </h1>
        <div className="text-xs text-slate-500 mt-1">Last updated: 5 September 2025</div>

        <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-slate-800">
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Mobile app:</b> no cookies or third-party trackers; only minimal data for login, orders, push notifications.</li>
            <li><b>Website (www.godavaii.com):</b> no advertising/analytics cookies; only strictly necessary cookies and server logs.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
