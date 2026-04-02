"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster } from "react-hot-toast";
import { Menu, Bell, AlertTriangle, Sun, Moon, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import GlobalLoader from "@/components/GlobalLoader";
import { apiGet, getPageRecords } from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type { PageResponse, ProductResponseModel } from "@/types";
import Link from "next/link";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const notificationRef = useRef<HTMLDivElement>(null);

  const fetchLowStock = useCallback(async () => {
    try {
      const data = await apiGet<PageResponse<ProductResponseModel>>(
        `${API_ENDPOINTS.PRODUCTS.LOW_STOCK}?Page=1&PageSize=10000`
      );
      const nextCount = getPageRecords<ProductResponseModel>(data).length;
      setLowStockCount((prev) => {
        if (nextCount > prev) {
          setHasNewNotification(true);
        }
        return nextCount;
      });
    } catch {
      setLowStockCount(0);
    }
  }, []);

  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  useEffect(() => {
    const stored = window.localStorage.getItem("inventory-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = stored === "dark" || stored === "light"
      ? (stored as "dark" | "light")
      : (prefersDark ? "dark" : "light");

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  // useEffect(() => {
  //   const onInventoryChanged = () => {
  //     fetchLowStock();
  //   };

  //   window.addEventListener("inventory:changed", onInventoryChanged);
  //   const timer = window.setInterval(fetchLowStock, 6000000000000);

  //   return () => {
  //     window.removeEventListener("inventory:changed", onInventoryChanged);
  //     window.clearInterval(timer);
  //   };
  // }, [fetchLowStock]);

  useEffect(() => {
    if (!notificationOpen) return;

    const onClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [notificationOpen]);

  function toggleNotifications() {
    setNotificationOpen((open) => {
      const next = !open;
      if (next) setHasNewNotification(false);
      return next;
    });
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("inventory-theme", nextTheme);
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: "0.88rem", borderRadius: "8px" },
        }}
      />
      <GlobalLoader />
      <div className="shell">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          lowStockCount={lowStockCount}
        />
        <main className="main-content">
          <header className="top-header">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <span className="top-header-title">Product Inventory Tracker</span>
            <div className="top-header-actions">
              <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              </button>

              <div className="notification-wrap" ref={notificationRef}>
                <button className="notification-btn" onClick={toggleNotifications} aria-label="Open notifications">
                  <Bell size={18} />
                  {lowStockCount > 0 && <span className="notification-badge">{lowStockCount > 9 ? "9+" : lowStockCount}</span>}
                  {hasNewNotification && (
                    <span className={`notification-dot ${lowStockCount > 0 ? "notification-dot-shifted" : ""}`} />
                  )}
                </button>

                {notificationOpen && (
                  <div className="notification-popover">
                    <div className="notification-popover-head">
                      <div className="notification-popover-title">Notifications</div>
                      <button
                        className="notification-close-btn"
                        onClick={() => setNotificationOpen(false)}
                        aria-label="Close notifications"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {lowStockCount > 0 ? (
                      <div className="notification-item">
                        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                        <div>
                          <div className="notification-item-text">
                            <strong>{lowStockCount}</strong> item{lowStockCount > 1 ? "s" : ""} below reorder threshold.
                          </div>
                          <Link
                            href="/low-stock"
                            className="notification-item-link"
                            onClick={() => setNotificationOpen(false)}
                          >
                            Click to view
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="notification-empty">No new alerts</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="page-content">{children}</div>
        </main>
      </div>
    </>
  );
}
