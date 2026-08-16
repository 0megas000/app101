import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { KioskApp } from "./kiosk/KioskApp";
import { AdminApp } from "./admin/AdminApp";
import { ThemeProvider } from "./design/theme";
import "./design/tokens.css";

const router = createBrowserRouter([
  // The kiosk is a dark-first appliance; the admin dashboard is ordinary
  // software and follows the operator's OS setting until they choose.
  { path: "/", element: <ThemeProvider defaultChoice="dark"><KioskApp /></ThemeProvider> },
  { path: "/admin/*", element: <ThemeProvider defaultChoice="system"><AdminApp /></ThemeProvider> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
