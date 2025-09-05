import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <div className="px-4 pt-4">
        <Button variant="ghost" className="btn-ghost-soft !font-bold mb-2" onClick={() => navigate(-1)}>
          ← Back
        </Button>

        <h1 className="text-[20px] font-extrabold" style={{ color: DEEP }}>
          Terms &amp; Conditions – GoDavaii
        </h1>
        <div className="text-xs text-slate-500 mt-1">Last updated: 5 September 2025</div>

        <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-slate-800">
          <p>
            These Terms govern your use of the GoDavaii mobile application and website (the “Platform”),
            operated by <b>KARNIVA PRIVATE LIMITED</b>. By using the Platform, you agree to these Terms.
          </p>

          <ol className="list-decimal pl-5 space-y-3">
            <li><b>Nature of Services</b><br />GoDavaii connects users to licensed pharmacies, doctors and labs. We are not a pharmacy or healthcare provider.</li>
            <li><b>Eligibility</b><br />Prescription/consultation/lab services are for users 18+ or minors with guardian consent.</li>
            <li><b>Prescription Medicines</b><br />Partner pharmacies verify prescriptions; GoDavaii does not approve them.</li>
            <li><b>OTC Products</b><br />OTC items may be ordered without a prescription, subject to availability.</li>
            <li><b>Role of Partners</b><br />Services are performed by licensed third parties; we’re not responsible for their advice or outcomes.</li>
            <li><b>Payments & Refunds</b><br />Processed via secure gateways. No cancellations/refunds unless required by law.</li>
            <li><b>Account & Data Deletion</b><br />Delete anytime via <b>Settings → Delete Account</b>; legally required records are retained.</li>
            <li><b>User Obligations</b><br />Provide accurate info; don’t upload fake prescriptions or order restricted substances.</li>
            <li><b>Limitation of Liability</b><br />We act as a facilitator and aren’t liable for quality, safety, or delivery delays by partners.</li>
            <li><b>Governing Law</b><br />Laws of India; courts in Noida, Uttar Pradesh.</li>
          </ol>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Contact</h2>
            <p className="mt-1">
              Support: <b>info@godavaii.com</b><br />
              Grievance: <b>grievance@godavaii.com</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
