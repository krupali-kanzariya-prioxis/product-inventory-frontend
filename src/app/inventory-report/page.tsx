"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { Package, TrendingUp, DollarSign } from "lucide-react";
import { apiGet, getPageRecords } from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type {
  PageResponse,
  ProductResponseModel,
  CategoryResponseModel,
  SupplierResponseModel,
  StockTransactionResponseModel,
} from "@/types";
import { formatCurrency } from "@/utils/helpers";

const CHART_COLORS = ["#3F4674", "#AFBFC0", "#847E89", "#56494C", "#9FA4A9", "#6e7bb5", "#c8d4d5"];

interface ReportStats {
  totalInventoryValue: number;
  avgProductValue: number;
  totalProducts: number;
  highValueProducts: ProductResponseModel[];
  categoryValue: { name: string; value: number; fill: string }[];
  supplierValue: { name: string; value: number; count: number; fill: string }[];
  stockTurnoverByMonth: { month: string; value: number }[];
}

export default function InventoryReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats>({
    totalInventoryValue: 0,
    avgProductValue: 0,
    totalProducts: 0,
    highValueProducts: [],
    categoryValue: [],
    supplierValue: [],
    stockTurnoverByMonth: [],
  });

  const buildMonthlyStockMovement = (transactions: StockTransactionResponseModel[]) => {
    const monthStarts: Date[] = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - idx));
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const buckets = new Map<string, number>();
    monthStarts.forEach((d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, 0);
    });

    transactions.forEach((t) => {
      const d = new Date(t.transactionDate);
      if (Number.isNaN(d.getTime())) return;

      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!buckets.has(key)) return;

      const quantity = Math.abs(Number(t.quantity) || 0);
      const signedQty = String(t.transactionType).toUpperCase() === "OUT" ? -quantity : quantity;
      buckets.set(key, (buckets.get(key) || 0) + signedQty);
    });

    return monthStarts.map((d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      return {
        month: d.toLocaleString("default", { month: "short" }),
        value: buckets.get(key) || 0,
      };
    });
  };

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const [products, categories, suppliers, transactions] = await Promise.all([
        apiGet<PageResponse<ProductResponseModel>>(`${API_ENDPOINTS.PRODUCTS.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<CategoryResponseModel>>(`${API_ENDPOINTS.CATEGORIES.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<SupplierResponseModel>>(`${API_ENDPOINTS.SUPPLIERS.LIST}?Page=1&PageSize=10000`),
        apiGet<PageResponse<StockTransactionResponseModel>>(
          `${API_ENDPOINTS.STOCK_TRANSACTIONS.LIST}?Page=1&PageSize=10000&SortColumn=transactionDate&SortOrder=DESC`
        ),
      ]);

      const allProducts = getPageRecords<ProductResponseModel>(products);
      const allTransactions = getPageRecords<StockTransactionResponseModel>(transactions);

      // Calculate total inventory value
      const totalValue = allProducts.reduce((sum, p) => sum + (p.unitPrice * p.currentStock), 0);
      const avgValue = allProducts.length > 0 ? totalValue / allProducts.length : 0;

      // Category value breakdown
      const catValueMap = new Map<string, number>();
      const catNames = new Map<string, string>();
      allProducts.forEach((p) => {
        const catName = p.categoryName || "Uncategorized";
        catNames.set(catName, catName);
        catValueMap.set(catName, (catValueMap.get(catName) || 0) + (p.unitPrice * p.currentStock));
      });

      const categoryValue = Array.from(catValueMap.entries())
        .map(([name, value], i) => ({
          name,
          value: Math.round(value),
          fill: CHART_COLORS[i % CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);

      // Supplier value breakdown
      const supplierValueMap = new Map<string, { value: number; count: number }>();
      allProducts.forEach((p) => {
        const supplierName = p.supplierName || "Unknown";
        const existing = supplierValueMap.get(supplierName) || { value: 0, count: 0 };
        supplierValueMap.set(supplierName, {
          value: existing.value + (p.unitPrice * p.currentStock),
          count: existing.count + 1,
        });
      });

      const supplierValue = Array.from(supplierValueMap.entries())
        .map(([name, { value, count }], i) => ({
          name: name.length > 20 ? name.slice(0, 20) + "..." : name,
          value: Math.round(value),
          count,
          fill: CHART_COLORS[i % CHART_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // High value products (top 10)
      const highValueProducts = [...allProducts]
        .sort((a, b) => (b.unitPrice * b.currentStock) - (a.unitPrice * a.currentStock))
        .slice(0, 10);

      // Stock movement by month (real transaction data, last 6 months)
      const stockTurnoverByMonth = buildMonthlyStockMovement(allTransactions);

      setStats({
        totalInventoryValue: totalValue,
        avgProductValue: avgValue,
        totalProducts: allProducts.length,
        highValueProducts,
        categoryValue,
        supplierValue,
        stockTurnoverByMonth,
      });
    } catch (error) {
      console.error("Error fetching inventory report:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (isLoading) {
    return <div className="page-content" style={{ padding: "2rem", textAlign: "center" }}>Loading inventory report...</div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>Inventory Report</h2>
      </div>

      <div className="dashboard-grid">
        <div className="widget">
          <div className="widget-icon widget-icon-primary"><DollarSign size={24} /></div>
          <div className="widget-body">
            <h3>Total Inventory Value</h3>
            <div className="widget-value">{formatCurrency(stats.totalInventoryValue)}</div>
            <div className="widget-sub">{stats.totalProducts} products</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-info"><Package size={24} /></div>
          <div className="widget-body">
            <h3>Avg Product Value</h3>
            <div className="widget-value">{formatCurrency(stats.avgProductValue)}</div>
            <div className="widget-sub">per item</div>
          </div>
        </div>
        <div className="widget">
          <div className="widget-icon widget-icon-accent"><TrendingUp size={24} /></div>
          <div className="widget-body">
            <h3>High-Value Items</h3>
            <div className="widget-value">{stats.highValueProducts.length}</div>
            <div className="widget-sub">top 10 products</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Inventory Value by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.categoryValue.slice(0, 8)}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => formatCurrency(Number(val))}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  color: "var(--color-text)",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {(stats.categoryValue.slice(0, 8) || []).map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Inventory Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.categoryValue.slice(0, 7)}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {stats.categoryValue.slice(0, 7).map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatCurrency(Number(val))} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => (value.length > 15 ? value.slice(0, 15) + "..." : value)}
                wrapperStyle={{ fontSize: "0.75rem" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Supplier Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.supplierValue}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => formatCurrency(Number(val))}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  color: "var(--color-text)",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {(stats.supplierValue || []).map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Monthly Stock Movement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.stockTurnoverByMonth} margin={{ top: 8, right: 18, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} padding={{ left: 10, right: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val) => formatCurrency(Number(val))}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  color: "var(--color-text)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#c8d4d5"
                strokeWidth={2}
                dot={{ fill: "#c8d4d5", r: 4 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Top 10 High-Value Items</h3>
          <div className="table-wrapper" style={{ border: "none", boxShadow: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Stock</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {stats.highValueProducts.map((p) => (
                  <tr key={p.productSid}>
                    <td style={{ fontWeight: 600 }}>{p.productName}</td>
                    <td>{p.categoryName || "—"}</td>
                    <td>{formatCurrency(p.unitPrice)}</td>
                    <td><span className="badge" style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}>{p.currentStock}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.unitPrice * p.currentStock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
