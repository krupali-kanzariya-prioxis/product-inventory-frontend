"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Search, Download } from "lucide-react";
import toast from "react-hot-toast";
import { apiGet, buildListQuery, getPageRecords, getPageTotal } from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type { PageResponse, ProductResponseModel } from "@/types";
import { formatCurrency, formatDate, exportToCSV } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";

export default function LowStockPage() {
  const [records, setRecords] = useState<ProductResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = buildListQuery({
        page,
        pageSize,
        sortColumn: "lastModifiedAt",
        sortOrder: "DESC",
        search,
      });
      const data = await apiGet<PageResponse<ProductResponseModel>>(
        `${API_ENDPOINTS.PRODUCTS.LOW_STOCK}${params}`
      );
      const fetched = getPageRecords<ProductResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load low stock data");
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "low-stock-products", [
      { key: "productName", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "categoryName", label: "Category" },
      { key: "supplierName", label: "Supplier" },
      { key: "currentStock", label: "Current Stock" },
      { key: "reorderThreshold", label: "Reorder Threshold" },
      { key: "unitPrice", label: "Unit Price" },
    ]);
  }

  return (
    <>
      <div className="page-header">
        <h2>Low Stock Alerts</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {records.length > 0 && (
        <div className="alert-banner alert-banner-danger">
          <AlertTriangle size={18} />
          <span>
            <strong>{records.length} product{records.length > 1 ? "s" : ""}</strong> currently below their reorder threshold and need to be restocked.
          </span>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search low stock products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Current Stock</th>
              <th>Reorder At</th>
              <th>Deficit</th>
              <th>Unit Price</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} className="table-empty">
                  {records.length === 0 ? (
                    <>
                      <AlertTriangle size={32} style={{ color: "var(--color-success)", opacity: 0.5 }} />
                      <div style={{ marginTop: "0.5rem" }}>All products are well stocked!</div>
                    </>
                  ) : (
                    "No matching products"
                  )}
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const deficit = r.reorderThreshold - r.currentStock;
                return (
                  <tr key={r.productSid}>
                    <td style={{ fontWeight: 600 }}>{r.productName}</td>
                    <td><code style={{ fontSize: "0.82rem", background: "var(--color-background)", padding: "2px 6px", borderRadius: 4 }}>{r.sku}</code></td>
                    <td>{r.categoryName || "—"}</td>
                    <td>{r.supplierName || "—"}</td>
                    <td><span className="badge badge-low-stock">{r.currentStock}</span></td>
                    <td>{r.reorderThreshold}</td>
                    <td style={{ color: "var(--color-danger)", fontWeight: 600 }}>-{deficit}</td>
                    <td>{formatCurrency(r.unitPrice)}</td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
    </>
  );
}