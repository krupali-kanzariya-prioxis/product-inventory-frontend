"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  Users,
  ArrowLeftRight,
  AlertTriangle,
  X,
  Boxes,
  BarChart3,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockCount: number;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/inventory-report", label: "Inventory Report", icon: BarChart3, section: "Analytics" },
  { href: "/products", label: "Products", icon: Package, section: "Inventory" },
  { href: "/categories", label: "Categories", icon: Tags, section: "Inventory" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, section: "Inventory" },
  { href: "/stock-transactions", label: "Stock Transactions", icon: ArrowLeftRight, section: "Inventory" },
  { href: "/low-stock", label: "Low Stock Alerts", icon: AlertTriangle, section: "Monitoring" },
  { href: "/users", label: "Users", icon: Users, section: "Administration" },
];

export default function Sidebar({ isOpen, onClose, lowStockCount }: SidebarProps) {
  const pathname = usePathname();

  const sections = Array.from(new Set(navItems.map((item) => item.section)));

  return (
    <>
      {isOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 29, background: "rgba(0,0,0,0.3)" }}
          onClick={onClose}
        />
      )}
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Boxes size={22} />
          </div>
          <div>
            <h1>Inventory</h1>
            <span>Product Tracker</span>
          </div>
          <button
            className="mobile-menu-btn"
            style={{ marginLeft: "auto", color: "#fff", display: isOpen ? "flex" : undefined }}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div key={section}>
              <div className="sidebar-section-label">{section}</div>
              {navItems
                .filter((item) => item.section === section)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
                      onClick={onClose}
                    >
                      <Icon size={18} />
                      {item.label}
                      {item.href === "/low-stock" && lowStockCount > 0 && (
                        <span className="sidebar-link-badge">{lowStockCount}</span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
