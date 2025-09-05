import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <Navbar />
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
            <li>
              <b>Nature of Services</b><br />
              GoDavaii is a technology platform connecting users to local licensed pharmacies and, where applicable,
              doctors and diagnostic labs. We are not a pharmacy or healthcare provider and do not sell or store medicines.
            </li>
            <li>
              <b>Eligibility</b><br />
              Prescription medicine ordering, doctor consultations, and lab services are for users 18+ or minors with
              parental/guardian consent.
            </li>
            <li>
              <b>Prescription Medicines</b><br />
              Some medicines require a valid prescription. You may need to upload one; partner pharmacies verify
              prescriptions. GoDavaii does not approve prescriptions.
            </li>
            <li>
              <b>OTC Products</b><br />
              OTC items may be ordered without a prescription, subject to availability.
            </li>
            <li>
              <b>Role of Partners</b><br />
              Medicines are sold/delivered by licensed pharmacies. Doctor and lab services are performed by qualified third parties.
              GoDavaii is not responsible for professional advice, diagnosis, treatment, or outcomes by those parties.
            </li>
            <li>
              <b>Payments & Refunds</b><br />
              Payments go through secure gateways. Once an order is placed, no cancellation or refund is allowed,
              unless required by law.
            </li>
            <li>
              <b>Account & Data Deletion</b><br />
              Delete anytime via in-app <b>Settings → Delete Account</b>. Personal data is removed except legally
              required records.
            </li>
            <li>
              <b>User Obligations</b><br />
              Provide accurate information, use only for lawful purposes, and never upload fake prescriptions or
              attempt to order restricted substances.
            </li>
            <li>
              <b>Limitation of Liability</b><br />
              We act as a facilitator. We are not liable for quality/safety/legality of medicines or services,
              prescription errors, professional advice, or delivery delays caused by partners.
            </li>
            <li>
              <b>Governing Law</b><br />
              Indian law applies; courts in Noida, Uttar Pradesh have jurisdiction.
            </li>
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
