import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { KioskApp } from "./kiosk/KioskApp";
import { AdminApp } from "./admin/AdminApp";
import "./design/tokens.css";

const router = createBrowserRouter([
  { path: "/", element: <KioskApp /> },
  { path: "/admin/*", element: <AdminApp /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
