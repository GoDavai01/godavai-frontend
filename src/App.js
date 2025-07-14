// src/App.js
import React, { useEffect } from "react";
import axios from "axios";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Navigate } from "react-router-dom";
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
import DeliveryDashboard from './components/DeliveryDashboard';
import RegisterDeliveryPartner from './components/RegisterDeliveryPartner';
import DriverSimulator from "./components/DriverSimulator";
import PharmacyRegistrationStepper from "./components/PharmacyRegistrationStepper";
import StepperStandalone from "./components/StepperStandalone";
import AdminRegistration from "./components/AdminRegistration";
import ProfilePage from "./components/ProfilePage";
import PharmaciesNearYou from './pages/PharmaciesNearYou';
import CheckoutPage from "./components/CheckoutPage";
import PaymentPage from "./components/PaymentPage";
import PaymentSuccess from "./components/PaymentSuccess";
import MyOrdersPage from "./components/MyOrdersPage";
import OrderTracking from "./components/OrderTracking";
import NotFound from "./components/NotFound";
import SearchResults from "./pages/SearchResults";
import AllMedicines from './pages/AllMedicines';

import ProtectedRoute from "./components/ProtectedRoute";

function AppContent() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/" || location.pathname === "/home";

  // --- Production-ready: Only set axios default once per token change ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = "Bearer " + token;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, []); // [] means only on mount

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
  <Route path="/" element={<WelcomePage />} />
  <Route path="/otp-login" element={<Navigate to="/home" replace />} />
  <Route path="/pharmacy/login" element={<PharmacyLogin />} />
  <Route path="/order/:orderId" element={<OrderTracking />} />
  <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
  <Route path="/orders/:orderId" element={<OrderTracking />} />
  <Route path="/test-standalone" element={<StepperStandalone />} />
  <Route path="*" element={<NotFound />} />

  {/* No ProtectedRoute here */}
  <Route element={<MainLayout />}>
    <Route path="/home" element={<Home />} />
    <Route path="/medicines/:pharmacyId" element={<Medicines />} />
    <Route path="/cart" element={<CartPage />} />
    <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
    <Route path="/pharmacy/register" element={<PharmacyRegistrationStepper />} />
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="/admin/register" element={<AdminRegistration />} />
    <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />
    <Route path="/delivery/register" element={<RegisterDeliveryPartner />} />
    <Route path="/driver-sim" element={<DriverSimulator />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/pharmacies-near-you" element={<PharmaciesNearYou />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/payment" element={<PaymentPage />} />
    <Route path="/payment-success" element={<PaymentSuccess />} />
    <Route path="/orders" element={<MyOrdersPage />} />
    <Route path="/search" element={<SearchResults />} />
    <Route path="/all-medicines" element={<AllMedicines />} />
  </Route>
</Routes>
      {!hideNavbar && <BottomNavBar />}
      <ViewCartBar />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <CartProvider>
          <Router>
            <AppContent />
          </Router>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
