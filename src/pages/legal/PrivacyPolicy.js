import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";

const DEEP = "#0f6e51";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white pb-24">
      <div className="px-4 pt-4">
        <Button variant="ghost" className="btn-ghost-soft !font-bold mb-2" onClick={() => navigate(-1)}>
          ← Back
        </Button>

        <h1 className="text-[20px] font-extrabold" style={{ color: DEEP }}>
          Privacy Policy – GoDavaii
        </h1>
        <div className="text-xs text-slate-500 mt-1">Last updated: 5 September 2025</div>

        <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-slate-800">
          <p>
            GoDavaii (“we”, “our”, “us”) is operated by <b>KARNIVA PRIVATE LIMITED</b>, a company
            incorporated under the laws of India. We are committed to protecting your privacy and ensuring
            the security of your personal information.
          </p>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Company Information</h2>
            <ul className="list-disc pl-5 mt-1">
              <li><b>Legal name:</b> KARNIVA PRIVATE LIMITED</li>
              <li>
                <b>Registered address:</b> 1st Floor, Galaxy Business Park, A-44 &amp; 45, Sushil Marg,
                Block A, Industrial Area, Sector 62, Noida, Uttar Pradesh 201309
              </li>
              <li><b>Support email:</b> info@godavaii.com</li>
              <li><b>Grievance Officer:</b> Mr. Pururva Agarwal</li>
              <li><b>Grievance email:</b> grievance@godavaii.com</li>
              <li><b>Grievance officer address:</b> Same as above</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>What we collect & why</h2>
            <p className="mt-1">
              We collect only what’s needed to provide core functionality: account details (name, email,
              mobile), delivery addresses, orders, and payment confirmations (handled by secure gateways).
              We do <b>not</b> run analytics or ads.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Children’s Use of Services</h2>
            <p className="mt-1">
              Our app does not contain adult or harmful content and may be accessible to users under 18.
              However, services such as prescription medicine ordering, doctor consultations, and lab tests
              are intended for individuals 18+ or for minors under the supervision and consent of a parent
              or legal guardian. We do not knowingly collect personal information from children under 18
              without parental consent. If you believe a minor has provided such information, please email
              <b> grievance@godavaii.com</b> and we will delete it.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Cookies & Tracking</h2>
            <ul className="list-disc pl-5 mt-1">
              <li>
                <b>Mobile app:</b> We do not use cookies or third-party trackers. Only the minimal data
                needed for login, orders, and push notifications is processed.
              </li>
              <li>
                <b>Website (www.godavaii.com):</b> We do not use cookies for advertising or analytics.
                We only use strictly necessary cookies and basic server logs for security and page
                functionality.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Data Retention</h2>
            <p className="mt-1">
              Order and transaction records are retained as required by Indian law (typically up to 8 years).
              All other personal data is deleted when your account is deleted.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-[15px]" style={{ color: DEEP }}>Account Deletion</h2>
            <p className="mt-1">
              You can delete your account instantly in the app: <b>Settings → Delete Account</b>. Once deleted,
              associated personal data is removed except where law requires retention.
              If you face any issue, email <b>grievance@godavaii.com</b>.
            </p>
          </div>

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
