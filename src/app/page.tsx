"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  Tags,
  Truck,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { apiGet, getPageRecords } from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type {
  PageResponse,
  ProductResponseModel,
  CategoryResponseModel,
  SupplierResponseModel,
  UserResponseModel,
  StockTransactionResponseModel,
} from "@/types";
import { formatDateTime, formatCurrency } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";

const CHART_COLORS = ["#3F4674", "#AFBFC0", "#847E89", "#56494C", "#9FA4A9", "#6e7bb5", "#c8d4d5"];

interface StockHealthItem {
  name: string;
  value: number;
  fill: string;
}

interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  totalUsers: number;
  lowStockCount: number;
  recentTransactions: StockTransactionResponseModel[];
  stockHealth: StockHealthItem[];
  topProducts: ProductResponseModel[];
  lowStockProducts: ProductResponseModel[];
}

export default function DashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("-");
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCategories: 0,
    totalSuppliers: 0,
    totalUsers: 0,
    lowStockCount: 0,
    recentTransactions: [],
    stockHealth: [],
    topProducts: [],
    lowStockProducts: [],
  });

  const fetchDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const [products, categories, suppliers, users, lowStock, transactions] = await Promise.all([
        apiGet<PageResponse<ProductResponseModel>>(`${API_ENDPOINTS.PRODUCTS.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<CategoryResponseModel>>(`${API_ENDPOINTS.CATEGORIES.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<SupplierResponseModel>>(`${API_ENDPOINTS.SUPPLIERS.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<UserResponseModel>>(`${API_ENDPOINTS.USERS.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<ProductResponseModel>>(`${API_ENDPOINTS.PRODUCTS.LOW_STOCK}?Page=1&PageSize=10000`),
        apiGet<PageResponse<StockTransactionResponseModel>>(
          `${API_ENDPOINTS.STOCK_TRANSACTIONS.LIST}?Page=1&PageSize=10&SortColumn=TransactionDate&SortOrder=DESC`
        ),
      ]);

      const allProducts = getPageRecords<ProductResponseModel>(products);
      const allCategories = getPageRecords<CategoryResponseModel>(categories);

      const wellStockedCount = allProducts.filter(p => p.currentStock >= p.reorderThreshold).length;
      const lowStockItemCount = allProducts.filter(p => p.currentStock > 0 && p.currentStock < p.reorderThreshold).length;
      const outOfStockCount = allProducts.filter(p => p.currentStock === 0).length;

      const stockHealth: StockHealthItem[] = [
        { name: "Well Stocked", value: wellStockedCount, fill: "#3F4674" },
        { name: "Low Stock", value: lowStockItemCount, fill: "#f59e0b" },
        { name: "Out of Stock", value: outOfStockCount, fill: "#9FA4A9" },
      ].filter(item => item.value > 0);

      const topProducts = [...allProducts]
        .sort((a, b) => b.unitPrice * b.currentStock - a.unitPrice * a.currentStock)
        .slice(0, 5);

      setStats({
        totalProducts: allProducts.length,
        totalCategories: allCategories.length,
        totalSuppliers: getPageRecords<SupplierResponseModel>(suppliers).length,
        totalUsers: getPageRecords<UserResponseModel>(users).length,
        lowStockCount: getPageRecords<ProductResponseModel>(lowStock).length,
        recentTransactions: getPageRecords<StockTransactionResponseModel>(transactions).slice(0, 8),
        stockHealth,
        topProducts,
        lowStockProducts: getPageRecords<ProductResponseModel>(lowStock).slice(0, 5),
      });
    } catch {
      // silently handle errors on dashboard
    } finally {
      setLastUpdated(formatDateTime(new Date().toISOString()));
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const timer = window.setInterval(fetchDashboard, 120000);
    const onInventoryChanged = () => fetchDashboard();
    window.addEventListener("inventory:changed", onInventoryChanged);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("inventory:changed", onInventoryChanged);
    };
  }, [fetchDashboard]);

  const stockChartData = stats.topProducts.map((p) => ({
    name: p.productName.length > 15 ? p.productName.slice(0, 15) + "..." : p.productName,
    value: p.unitPrice * p.currentStock,
  }));

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <div className="page-header-actions">
          <span className="form-hint">Last updated: {lastUpdated}</span>
          <button className="btn btn-outline btn-sm" onClick={fetchDashboard} disabled={isRefreshing}>
            <RefreshCw size={14} className={isRefreshing ? "spin-icon" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="widget">
          <div className="widget-icon widget-icon-primary"><Package size={24} /></div>
          <div className="widget-body">
            <h3>Total Products</h3>
            <div className="widget-value">{stats.totalProducts}</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-info"><Tags size={24} /></div>
          <div className="widget-body">
            <h3>Categories</h3>
            <div className="widget-value">{stats.totalCategories}</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-accent"><Truck size={24} /></div>
          <div className="widget-body">
            <h3>Suppliers</h3>
            <div className="widget-value">{stats.totalSuppliers}</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-success"><Users size={24} /></div>
          <div className="widget-body">
            <h3>Users</h3>
            <div className="widget-value">{stats.totalUsers}</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-warning"><AlertTriangle size={24} /></div>
          <div className="widget-body">
            <h3>Low Stock</h3>
            <div className="widget-value">{stats.lowStockCount}</div>
            <div className="widget-sub">Below reorder threshold</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Top Products by Stock Value</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stockChartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => (typeof val === "number" ? formatCurrency(val) : String(val ?? ""))}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  color: "var(--color-text)",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {stockChartData.map((_, i) => (
                  <Cell key={`bar-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Product Stock Health</h3>
          <div className="chart-with-center">
            <ResponsiveContainer width="100%" height={310}>
              <PieChart>
                <Pie
                  data={stats.stockHealth}
                  cx="50%"
                  cy="44%"
                  outerRadius={105}
                  innerRadius={58}
                  dataKey="value"
                  paddingAngle={4}
                  strokeWidth={0}
                >
                  {stats.stockHealth.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} product${Number(value) !== 1 ? "s" : ""}`, String(name)]}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "10px",
                    color: "var(--color-text)",
                    fontSize: "0.82rem",
                  }}
                  itemStyle={{ color: "var(--color-text)" }}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: "0.8rem", paddingTop: "10px", color: "var(--color-text)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-center-label">
              <strong>{stats.totalProducts}</strong>
              <span>Total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Recent Stock Transactions</h3>
          {stats.recentTransactions.length === 0 ? (
            <p style={{ color: "var(--color-neutral)", padding: "1rem 0" }}>No recent transactions</p>
          ) : (
            <div className="activity-list">
              {stats.recentTransactions.map((t) => (
                <div className="activity-item" key={t.stockTransactionSid}>
                  <div className={`activity-dot ${t.transactionType === "IN" ? "activity-dot-in" : "activity-dot-out"}`} />
                  <div className="activity-detail">
                    <span>
                      {t.transactionType === "IN" ? (
                        <TrendingUp size={14} style={{ display: "inline", marginRight: 4 }} />
                      ) : (
                        <TrendingDown size={14} style={{ display: "inline", marginRight: 4 }} />
                      )}
                      <strong>{t.productName}</strong> - {t.transactionType === "IN" ? "Stock In" : "Stock Out"} x {t.quantity}
                    </span>
                    <div className="activity-time">{formatDateTime(t.transactionDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card">
          <h3>Low Stock Products</h3>
          {stats.lowStockProducts.length === 0 ? (
            <p style={{ color: "var(--color-neutral)", padding: "1rem 0" }}>All products are well stocked!</p>
          ) : (
            <div className="table-wrapper" style={{ border: "none", boxShadow: "none" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.lowStockProducts.map((p) => (
                    <tr key={p.productSid}>
                      <td>{p.productName}</td>
                      <td><span className="badge badge-low-stock">{p.currentStock}</span></td>
                      <td>{p.reorderThreshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
