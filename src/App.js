// src/App.js
import React, { useEffect } from "react";
import axios from "axios";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import "./i18n";
import { ThemeProvider } from "./context/ThemeContext";
import CssBaseline from "@mui/material/CssBaseline";

import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import BottomNavBar from "./components/BottomNavBar";
import MainLayout from "./components/MainLayout";
import Home from "./components/Home";
import PharmacyLogin from "./pages/PharmacyLogin";
import ViewCartBar from "./components/ViewCartBar";
import Medicines from "./components/Medicines";
import CartPage from "./components/CartPage";
import WelcomePage from "./components/WelcomePage";
import OtpLogin from "./components/OtpLogin";
import PharmacyDashboard from "./components/PharmacyDashboard";
import AdminDashboard from "./components/AdminDashboard";
import DeliveryDashboard from "./components/DeliveryDashboard";
import RegisterDeliveryPartner from "./components/RegisterDeliveryPartner";
import DriverSimulator from "./components/DriverSimulator";
import PharmacyRegistrationStepper from "./components/PharmacyRegistrationStepper";
import StepperStandalone from "./components/StepperStandalone";
import AdminRegistration from "./components/AdminRegistration";
import ProfilePage from "./components/ProfilePage";
import PharmaciesNearYou from "./pages/PharmaciesNearYou";
import CheckoutPage from "./components/CheckoutPage";
import PaymentPage from "./components/PaymentPage";
import PaymentSuccess from "./components/PaymentSuccess";
import MyOrdersPage from "./components/MyOrdersPage";
import OrderTracking from "./components/OrderTracking";
import NotFound from "./components/NotFound";
import SearchResults from "./pages/SearchResults";
import { LocationProvider } from "./context/LocationContext";
import ProtectedRoute from "./components/ProtectedRoute";

// legal pages
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import Terms from "./pages/legal/Terms";
import Refunds from "./pages/legal/Refunds";
import Cookies from "./pages/legal/Cookies";
import DeleteAccount from "./pages/legal/DeleteAccount";

// Android Back
import { App as CapApp } from "@capacitor/app";
import { useAndroidBack } from "./hooks/useAndroidBack";

// Notifications / Push
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { CapacitorHttp } from "@capacitor/core";

const subscribers = new Set();
export function onAppEvent(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
export function emitAppEvent(evt) {
  subscribers.forEach((cb) => cb(evt));
}

const ROOT_ROUTES = new Set(["/", "/home", "/otp-login"]);

function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useAndroidBack({
    onBack: () => {
      if (!ROOT_ROUTES.has(location.pathname)) navigate(-1);
    },
    onExit: () => CapApp.exitApp(),
  });

  return children;
}

function AppContent() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/" || location.pathname === "/home";

  React.useEffect(() => {
    const isWelcome = location.pathname === "/";
    document.documentElement.classList.toggle("gd-welcome", isWelcome);
    return () => document.documentElement.classList.remove("gd-welcome");
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) axios.defaults.headers.common["Authorization"] = "Bearer " + token;
    else delete axios.defaults.headers.common["Authorization"];
  }, []);

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/otp-login" element={<OtpLogin />} />
        <Route path="/pharmacy/login" element={<PharmacyLogin />} />
        <Route path="/order/:orderId" element={<OrderTracking />} />
        <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
        <Route path="/orders/:orderId" element={<OrderTracking />} />
        <Route path="/test-standalone" element={<StepperStandalone />} />

        {/* legal */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/delete-account" element={<DeleteAccount />} />

        <Route path="*" element={<NotFound />} />

        <Route element={<MainLayout />}>
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* ✅ 2035 marketplace default */}
          <Route
            path="/medicines"
            element={
              <ProtectedRoute>
                <Medicines />
              </ProtectedRoute>
            }
          />

          {/* optional legacy/debug */}
          <Route
            path="/medicines/:pharmacyId"
            element={
              <ProtectedRoute>
                <Medicines />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pharmacy/dashboard"
            element={
              <ProtectedRoute>
                <PharmacyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pharmacy/register"
            element={
              <ProtectedRoute>
                <PharmacyRegistrationStepper />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/register"
            element={
              <ProtectedRoute>
                <AdminRegistration />
              </ProtectedRoute>
            }
          />

          <Route
            path="/delivery/dashboard"
            element={
              <ProtectedRoute>
                <DeliveryDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery/register"
            element={
              <ProtectedRoute>
                <RegisterDeliveryPartner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver-sim"
            element={
              <ProtectedRoute>
                <DriverSimulator />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pharmacies-near-you"
            element={
              <ProtectedRoute>
                <PharmaciesNearYou />
              </ProtectedRoute>
            }
          />

          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <PaymentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment-success"
            element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <MyOrdersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/all-medicines"
            element={
              <ProtectedRoute>
                <Medicines />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>

      {!hideNavbar && <BottomNavBar />}
      <ViewCartBar />
    </>
  );
}

function App() {
  useEffect(() => {
    if (!Capacitor?.isNativePlatform?.()) return;
    if (Capacitor.getPlatform?.() !== "android") return;

    (async () => {
      try {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.createChannel({
          id: "gd_orders",
          name: "Order Alerts",
          description: "New orders and urgent pharmacy notifications",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!Capacitor?.isNativePlatform?.()) return;
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;
        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token) => {
          try {
            const jwt = localStorage.getItem("token");
            if (!jwt) return;
            await CapacitorHttp.post({
              url: (process.env.REACT_APP_API_BASE_URL || "http://localhost:5000") + "/api/prescriptions/register-fcm",
              headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json" },
              data: { token: token?.value || token },
            });
          } catch {}
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const orderId = action?.notification?.data?.orderId;
          if (!orderId) return;
          emitAppEvent({ type: "OPEN_RX_QUOTE", orderId });
        });
      } catch {}
    })();
  }, []);

  return (
    <ThemeProvider>
      <CssBaseline />
      <LocationProvider>
        <AuthProvider>
          <CartProvider>
            <Router>
              <AppShell>
                <AppContent />
              </AppShell>
            </Router>
          </CartProvider>
        </AuthProvider>
      </LocationProvider>
    </ThemeProvider>
  );
}

export default App;