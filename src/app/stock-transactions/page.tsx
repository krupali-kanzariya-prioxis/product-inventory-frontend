"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Download } from "lucide-react";
import toast from "react-hot-toast";
import {
  apiGet,
  apiPost,
  buildListQuery,
  getPageRecords,
  getPageTotal,
  type FilterParam,
} from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type {
  PageResponse,
  StockTransactionResponseModel,
  StockTransactionRequestModel,
  SelectListItem,
  FieldErrors,
  TouchedFields,
} from "@/types";
import type { ProductResponseModel } from "@/types";
import { formatDateTime, exportToCSV } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";

const emptyForm: StockTransactionRequestModel = {
  productSid: "",
  transactionType: "IN",
  quantity: 1,
  notes: "",
};

export default function StockTransactionsPage() {
  const [records, setRecords] = useState<StockTransactionResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  // Dropdown
  const [products, setProducts] = useState<SelectListItem[]>([]);

  // Live stock lookup for OUT hint
  const [selectedProductStock, setSelectedProductStock] = useState<number | null>(null);

  // Add modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StockTransactionRequestModel>({ ...emptyForm });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitAttempt, setSubmitAttempt] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await apiGet<SelectListItem[]>(API_ENDPOINTS.PRODUCTS.DDL);
      setProducts(data || []);
    } catch {
      console.error("Failed to load products for dropdown");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const filters: FilterParam[] = [];
      if (filterType) {
        filters.push({ key: "TransactionType", condition: "=", value: filterType });
      }

      const params = buildListQuery({
        page,
        pageSize,
        sortColumn: "transactionDate",
        sortOrder: "DESC",
        search,
        filters,
      });
      const data = await apiGet<PageResponse<StockTransactionResponseModel>>(`${API_ENDPOINTS.STOCK_TRANSACTIONS.LIST}${params}`);
      const fetched = getPageRecords<StockTransactionResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load transactions");
    }
  }, [page, pageSize, search, filterType]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!form.productSid) { setSelectedProductStock(null); return; }
    apiGet<ProductResponseModel>(API_ENDPOINTS.PRODUCTS.BY_SID(form.productSid))
      .then((p) => setSelectedProductStock(p.currentStock))
      .catch(() => setSelectedProductStock(null));
  }, [form.productSid]);

  function validate(f: StockTransactionRequestModel): FieldErrors {
    const e: FieldErrors = {};
    if (!f.productSid) e.productSid = "Product is required";
    if (!f.transactionType) e.transactionType = "Transaction type is required";
    if (!f.quantity || f.quantity <= 0) e.quantity = "Quantity must be greater than 0";
    if (f.quantity > 99999) e.quantity = "Quantity is too large";
    return e;
  }

  function handleFieldChange(field: keyof StockTransactionRequestModel, value: string | number) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (touched[field] || submitAttempt) setErrors(validate(updated));
  }

  function handleBlur(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(form));
  }

  function openAdd() {
    setForm({ ...emptyForm });
    setErrors({});
    setTouched({});
    setSubmitAttempt(false);
    setModalOpen(true);
  }

  async function handleSave() {
    setSubmitAttempt(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await apiPost(API_ENDPOINTS.STOCK_TRANSACTIONS.ADD, form);
      toast.success(`Stock ${form.transactionType === "IN" ? "added" : "removed"} successfully`);
      window.dispatchEvent(new CustomEvent("inventory:changed"));
      setModalOpen(false);
      fetchData();
    } catch (err) {
      let msg = "Failed to record transaction";
      if (err instanceof Error) {
        try { msg = (JSON.parse(err.message) as { message?: string }).message ?? err.message; } catch { msg = err.message; }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "stock-transactions", [
      { key: "productName", label: "Product" },
      { key: "transactionType", label: "Type" },
      { key: "quantity", label: "Quantity" },
      { key: "notes", label: "Notes" },
      { key: "transactionDate", label: "Date" },
    ]);
  }

  return (
    <>
      <div className="page-header">
        <h2>Stock Transactions</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> New Transaction
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by product or notes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-select"
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          style={{ width: "auto", minWidth: 150 }}
        >
          <option value="">All Types</option>
          <option value="IN">Stock In</option>
          <option value="OUT">Stock Out</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Notes</th>
              <th>Transaction Date</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No transactions found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.stockTransactionSid}>
                  <td style={{ fontWeight: 600 }}>{r.productName}</td>
                  <td>
                    <span className={`badge ${r.transactionType === "IN" ? "badge-in" : "badge-out"}`}>
                      {r.transactionType === "IN" ? "Stock In" : "Stock Out"}
                    </span>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.notes || "—"}</td>
                  <td>{formatDateTime(r.transactionDate)}</td>
                </tr>
              ))
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Stock Transaction"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Record Transaction"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Product <span className="required">*</span></label>
            <select
              className={`form-select ${(touched.productSid || submitAttempt) && errors.productSid ? "form-select-error" : ""}`}
              value={form.productSid}
              onChange={(e) => handleFieldChange("productSid", e.target.value)}
              onBlur={() => handleBlur("productSid")}
            >
              <option value="">— Select Product —</option>
              {products.map((p) => (
                <option key={p.value} value={p.value}>{p.text}</option>
              ))}
            </select>
            {(touched.productSid || submitAttempt) && errors.productSid && <span className="form-error">{errors.productSid}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Transaction Type <span className="required">*</span></label>
            <select
              className={`form-select ${(touched.transactionType || submitAttempt) && errors.transactionType ? "form-select-error" : ""}`}
              value={form.transactionType}
              onChange={(e) => handleFieldChange("transactionType", e.target.value)}
              onBlur={() => handleBlur("transactionType")}
            >
              <option value="IN">Stock In (Add)</option>
              <option value="OUT">Stock Out (Remove)</option>
            </select>
            {(touched.transactionType || submitAttempt) && errors.transactionType && <span className="form-error">{errors.transactionType}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Quantity <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.quantity || submitAttempt) && errors.quantity ? "form-input-error" : ""}`}
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => handleFieldChange("quantity", parseInt(e.target.value) || 0)}
              onBlur={() => handleBlur("quantity")}
            />
            {(touched.quantity || submitAttempt) && errors.quantity && <span className="form-error">{errors.quantity}</span>}
            {selectedProductStock !== null && form.transactionType === "OUT" && (
              <span className="form-hint" style={{ color: form.quantity > selectedProductStock ? "var(--color-danger)" : "var(--color-info)" }}>
                Available stock: <strong>{selectedProductStock}</strong> units
                {form.quantity > 0 && (
                  <> · After removal: <strong>{selectedProductStock - form.quantity}</strong>{form.quantity > selectedProductStock ? " ⚠ Insufficient stock" : ""}</>
                )}
              </span>
            )}
            {selectedProductStock !== null && form.transactionType === "IN" && (
              <span className="form-hint">
                Current: <strong>{selectedProductStock}</strong> · After addition: <strong>{selectedProductStock + (form.quantity || 0)}</strong>
              </span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={form.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Optional notes"
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}