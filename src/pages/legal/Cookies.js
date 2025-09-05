import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function Cookies() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <Navbar />
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
            <li>
              <b>Mobile app:</b> We do not use cookies or third-party tracking technologies. We also do not
              run ads or analytics tools. Only information necessary for login, order processing, and push
              notifications is processed.
            </li>
            <li>
              <b>Website (www.godavaii.com):</b> We do not use cookies for advertising or analytics. We use only
              strictly necessary cookies and server logs for security, functionality, and SEO basics.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
