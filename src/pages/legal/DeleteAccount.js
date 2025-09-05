import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function DeleteAccount() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <div className="px-4 pt-4">
        <Button variant="ghost" className="btn-ghost-soft !font-bold mb-2" onClick={() => navigate(-1)}>
          ← Back
        </Button>

        <h1 className="text-[20px] font-extrabold" style={{ color: DEEP }}>
          Delete Your Account
        </h1>
        <div className="text-xs text-slate-500 mt-1">Instant in-app deletion available</div>

        <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-slate-800">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open the GoDavaii app and go to <b>Profile → Settings</b>.</li>
            <li>Tap <b>Delete Account</b> and confirm.</li>
            <li>Your account and personal data are deleted immediately, except order/transaction records retained by law (typically up to 8 years).</li>
          </ol>
          <p className="mt-2">If you face any issues, email <b>grievance@godavaii.com</b>.</p>
        </div>
      </div>
    </div>
  );
}
