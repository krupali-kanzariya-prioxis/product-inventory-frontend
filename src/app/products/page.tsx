"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Download, Eye, History, Copy, PackagePlus, PackageMinus, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";
import {
  apiGet,
  apiPost,
  apiDelete,
  buildListQuery,
  getPageRecords,
  getPageTotal,
} from "@/services/api.service";
import { type FilterParam } from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type {
  PageResponse,
  ProductResponseModel,
  ProductRequestModel,
  SelectListItem,
  StockTransactionResponseModel,
  FieldErrors,
  TouchedFields,
} from "@/types";
import { formatDate, formatDateTime, formatCurrency, exportToCSV } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const emptyForm: ProductRequestModel = {
  productName: "",
  sku: "",
  description: "",
  categorySid: "",
  supplierSid: "",
  unitPrice: 0,
  currentStock: 0,
  reorderThreshold: 10,
};

export default function ProductsPage() {
  const [records, setRecords] = useState<ProductResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");

  // Dropdowns
  const [categories, setCategories] = useState<SelectListItem[]>([]);
  const [suppliers, setSuppliers] = useState<SelectListItem[]>([]);

  const [filterCategorySid, setFilterCategorySid] = useState("");
  const [filterSupplierSid, setFilterSupplierSid] = useState("");

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSid, setEditingSid] = useState<string | null>(null);
  const [form, setForm] = useState<ProductRequestModel>({ ...emptyForm });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitAttempt, setSubmitAttempt] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductResponseModel | null>(null);

  // Stock history modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<ProductResponseModel | null>(null);
  const [historyRecords, setHistoryRecords] = useState<StockTransactionResponseModel[]>([]);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSid, setDeleteSid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Row action menu
  const [openMenuSid, setOpenMenuSid] = useState<string | null>(null);

  // Quick stock adjust
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockProduct, setQuickStockProduct] = useState<ProductResponseModel | null>(null);
  const [quickStockType, setQuickStockType] = useState<"IN" | "OUT">("IN");
  const [quickStockQty, setQuickStockQty] = useState(1);
  const [quickStockNotes, setQuickStockNotes] = useState("");
  const [quickStockSaving, setQuickStockSaving] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuSid) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".action-menu-wrap")) setOpenMenuSid(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuSid]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [cats, sups] = await Promise.all([
        apiGet<SelectListItem[]>(API_ENDPOINTS.CATEGORIES.DDL),
        apiGet<SelectListItem[]>(API_ENDPOINTS.SUPPLIERS.DDL),
      ]);
      setCategories(cats || []);
      setSuppliers(sups || []);
    } catch {
      console.error("Failed to load dropdown data");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const filters: FilterParam[] = [];
      if (filterCategorySid) filters.push({ key: "CategorySid", condition: "=", value: filterCategorySid });
      if (filterSupplierSid) filters.push({ key: "SupplierSid", condition: "=", value: filterSupplierSid });
      const params = buildListQuery({
        page,
        pageSize,
        sortColumn: "lastModifiedAt",
        sortOrder: "DESC",
        search,
        filters,
      });
      const data = await apiGet<PageResponse<ProductResponseModel>>(`${API_ENDPOINTS.PRODUCTS.LIST}${params}`);
      const fetched = getPageRecords<ProductResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load products");
    }
  }, [page, pageSize, search, filterCategorySid, filterSupplierSid]);

  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Validation
  function validate(f: ProductRequestModel): FieldErrors {
    const e: FieldErrors = {};
    if (!f.productName.trim()) e.productName = "Product name is required";
    else if (f.productName.trim().length > 200) e.productName = "Must be 200 characters or less";
    if (!f.sku.trim()) e.sku = "SKU is required";
    else if (f.sku.trim().length > 50) e.sku = "Must be 50 characters or less";
    if (f.unitPrice < 0) e.unitPrice = "Unit price cannot be negative";
    if (f.currentStock < 0) e.currentStock = "Current stock cannot be negative";
    if (f.reorderThreshold < 0) e.reorderThreshold = "Reorder threshold cannot be negative";
    return e;
  }

  function handleFieldChange(field: keyof ProductRequestModel, value: string | number) {
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
    setEditingSid(null);
    setErrors({});
    setTouched({});
    setSubmitAttempt(false);
    setModalOpen(true);
  }

  async function openEdit(sid: string) {
    try {
      const data = await apiGet<ProductResponseModel>(API_ENDPOINTS.PRODUCTS.BY_SID(sid));
      // We need to find the category and supplier SIDs from dropdown
      const catItem = categories.find((c) => c.text === data.categoryName);
      const supItem = suppliers.find((s) => s.text === data.supplierName);
      setForm({
        productName: data.productName,
        sku: data.sku,
        description: data.description || "",
        categorySid: catItem?.value || "",
        supplierSid: supItem?.value || "",
        unitPrice: data.unitPrice,
        currentStock: data.currentStock,
        reorderThreshold: data.reorderThreshold,
      });
      setEditingSid(sid);
      setErrors({});
      setTouched({});
      setSubmitAttempt(false);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load product");
    }
  }

  async function openDetail(sid: string) {
    try {
      const data = await apiGet<ProductResponseModel>(API_ENDPOINTS.PRODUCTS.BY_SID(sid));
      setDetailProduct(data);
      setDetailOpen(true);
    } catch {
      toast.error("Failed to load product details");
    }
  }

  async function openHistory(product: ProductResponseModel) {
    try {
      const data = await apiGet<PageResponse<StockTransactionResponseModel>>(
        `${API_ENDPOINTS.STOCK_TRANSACTIONS.PRODUCT_HISTORY(product.productSid)}?page=1&pageSize=100&sortColumn=transactionDate&sortOrder=DESC`
      );
      setHistoryProduct(product);
      setHistoryRecords(getPageRecords<StockTransactionResponseModel>(data));
      setHistoryOpen(true);
    } catch {
      toast.error("Failed to load stock history");
    }
  }

  async function handleSave() {
    setSubmitAttempt(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      if (editingSid) {
        await apiPost(API_ENDPOINTS.PRODUCTS.UPDATE(editingSid), form);
        toast.success("Product updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.PRODUCTS.ADD, form);
        toast.success("Product added successfully");
      }
      window.dispatchEvent(new CustomEvent("inventory:changed"));
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteSid) return;
    setDeleting(true);
    try {
      await apiDelete(API_ENDPOINTS.PRODUCTS.DELETE(deleteSid));
      toast.success("Product deleted successfully");
      window.dispatchEvent(new CustomEvent("inventory:changed"));
      setDeleteOpen(false);
      setDeleteSid(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "products", [
      { key: "productName", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "categoryName", label: "Category" },
      { key: "supplierName", label: "Supplier" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "currentStock", label: "Current Stock" },
      { key: "reorderThreshold", label: "Reorder Threshold" },
      { key: "createdAt", label: "Created At" },
    ]);
  }

  function copySKUToClipboard(sku: string) {
    navigator.clipboard.writeText(sku).then(() => {
      toast.success(`SKU ${sku} copied to clipboard`);
    }).catch(() => {
      toast.error("Failed to copy SKU");
    });
  }

  function openQuickStock(product: ProductResponseModel, type: "IN" | "OUT") {
    setQuickStockProduct(product);
    setQuickStockType(type);
    setQuickStockQty(1);
    setQuickStockNotes("");
    setQuickStockOpen(true);
  }

  async function handleQuickStockSave() {
    if (!quickStockProduct || quickStockQty <= 0) return;
    setQuickStockSaving(true);
    try {
      await apiPost(API_ENDPOINTS.STOCK_TRANSACTIONS.ADD, {
        productSid: quickStockProduct.productSid,
        transactionType: quickStockType,
        quantity: quickStockQty,
        notes: quickStockNotes || null,
      });
      toast.success(`Stock ${quickStockType === "IN" ? "added to" : "removed from"} ${quickStockProduct.productName}`);
      window.dispatchEvent(new CustomEvent("inventory:changed"));
      setQuickStockOpen(false);
      fetchData();
    } catch (err) {
      let msg = "Failed to adjust stock";
      if (err instanceof Error) {
        try { msg = (JSON.parse(err.message) as { message?: string }).message ?? err.message; } catch { msg = err.message; }
      }
      toast.error(msg);
    } finally {
      setQuickStockSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Products</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search products, SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="form-select"
          value={filterCategorySid}
          onChange={(e) => { setFilterCategorySid(e.target.value); setPage(1); }}
          style={{ width: "auto", minWidth: 160 }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.text}</option>)}
        </select>
        <select
          className="form-select"
          value={filterSupplierSid}
          onChange={(e) => { setFilterSupplierSid(e.target.value); setPage(1); }}
          style={{ width: "auto", minWidth: 160 }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.value} value={s.value}>{s.text}</option>)}
        </select>
        {(filterCategorySid || filterSupplierSid) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFilterCategorySid(""); setFilterSupplierSid(""); setPage(1); }}>
            Clear Filters
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Reorder At</th>
              <th>Created</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">No products found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.productSid}>
                  <td style={{ fontWeight: 600 }}>{r.productName}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <code style={{ fontSize: "0.82rem", background: "var(--color-background)", padding: "2px 6px", borderRadius: 4 }}>{r.sku}</code>
                      <button 
                        className="btn btn-ghost" 
                        style={{ padding: "0.2rem", minWidth: "auto" }} 
                        title="Copy SKU" 
                        onClick={() => copySKUToClipboard(r.sku)}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td>{r.categoryName || "—"}</td>
                  <td>{r.supplierName || "—"}</td>
                  <td>{formatCurrency(r.unitPrice)}</td>
                  <td>
                    {r.currentStock <= r.reorderThreshold ? (
                      <span className="badge badge-low-stock">{r.currentStock}</span>
                    ) : (
                      r.currentStock
                    )}
                  </td>
                  <td>{r.reorderThreshold}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td className="col-actions">
                    <button className="btn btn-ghost btn-icon-view" title="View Details" onClick={() => openDetail(r.productSid)}>
                      <Eye size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon-edit" title="Edit" onClick={() => openEdit(r.productSid)}>
                      <Pencil size={16} />
                    </button>
                    <div className="action-menu-wrap">
                      <button
                        className="action-menu-trigger"
                        title="More actions"
                        onClick={() => setOpenMenuSid(openMenuSid === r.productSid ? null : r.productSid)}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuSid === r.productSid && (
                        <div className="action-menu-dropdown">
                          <button className="action-menu-item action-menu-stock-in" onClick={() => { setOpenMenuSid(null); openQuickStock(r, "IN"); }}>
                            <PackagePlus size={14} /> Quick Stock In
                          </button>
                          <button className="action-menu-item action-menu-stock-out" onClick={() => { setOpenMenuSid(null); openQuickStock(r, "OUT"); }}>
                            <PackageMinus size={14} /> Quick Stock Out
                          </button>
                          <hr className="action-menu-divider" />
                          <button className="action-menu-item" onClick={() => { setOpenMenuSid(null); openHistory(r); }}>
                            <History size={14} /> Stock History
                          </button>
                          <hr className="action-menu-divider" />
                          <button className="action-menu-item action-menu-danger" onClick={() => { setOpenMenuSid(null); setDeleteSid(r.productSid); setDeleteOpen(true); }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSid ? "Edit Product" : "Add Product"}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingSid ? "Update" : "Add"}
            </button>
          </>
        }
      >
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Product Name <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.productName || submitAttempt) && errors.productName ? "form-input-error" : ""}`}
              value={form.productName}
              onChange={(e) => handleFieldChange("productName", e.target.value)}
              onBlur={() => handleBlur("productName")}
              placeholder="Enter product name"
            />
            {(touched.productName || submitAttempt) && errors.productName && <span className="form-error">{errors.productName}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">SKU <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.sku || submitAttempt) && errors.sku ? "form-input-error" : ""}`}
              value={form.sku}
              onChange={(e) => handleFieldChange("sku", e.target.value)}
              onBlur={() => handleBlur("sku")}
              placeholder="e.g. PRD-001"
            />
            {(touched.sku || submitAttempt) && errors.sku && <span className="form-error">{errors.sku}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={form.categorySid || ""}
              onChange={(e) => handleFieldChange("categorySid", e.target.value)}
            >
              <option value="">— Select Category —</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.text}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select
              className="form-select"
              value={form.supplierSid || ""}
              onChange={(e) => handleFieldChange("supplierSid", e.target.value)}
            >
              <option value="">— Select Supplier —</option>
              {suppliers.map((s) => (
                <option key={s.value} value={s.value}>{s.text}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.unitPrice || submitAttempt) && errors.unitPrice ? "form-input-error" : ""}`}
              type="number"
              step="0.01"
              min="0"
              value={form.unitPrice}
              onChange={(e) => handleFieldChange("unitPrice", parseFloat(e.target.value) || 0)}
              onBlur={() => handleBlur("unitPrice")}
            />
            {(touched.unitPrice || submitAttempt) && errors.unitPrice && <span className="form-error">{errors.unitPrice}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Current Stock <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.currentStock || submitAttempt) && errors.currentStock ? "form-input-error" : ""}`}
              type="number"
              min="0"
              value={form.currentStock}
              onChange={(e) => handleFieldChange("currentStock", parseInt(e.target.value) || 0)}
              onBlur={() => handleBlur("currentStock")}
            />
            {(touched.currentStock || submitAttempt) && errors.currentStock && <span className="form-error">{errors.currentStock}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Reorder Threshold <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.reorderThreshold || submitAttempt) && errors.reorderThreshold ? "form-input-error" : ""}`}
              type="number"
              min="0"
              value={form.reorderThreshold}
              onChange={(e) => handleFieldChange("reorderThreshold", parseInt(e.target.value) || 0)}
              onBlur={() => handleBlur("reorderThreshold")}
            />
            {(touched.reorderThreshold || submitAttempt) && errors.reorderThreshold && <span className="form-error">{errors.reorderThreshold}</span>}
            <span className="form-hint">Alert when stock falls below this number</span>
          </div>
          <div className="form-group form-group-full">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={form.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Enter product description (optional)"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Product Details"
        size="lg"
        footer={<button className="btn btn-outline" onClick={() => setDetailOpen(false)}>Close</button>}
      >
        {detailProduct && (
          <div className="detail-grid">
            <div className="detail-item">
              <label>Product Name</label>
              <span>{detailProduct.productName}</span>
            </div>
            <div className="detail-item">
              <label>SKU</label>
              <span>{detailProduct.sku}</span>
            </div>
            <div className="detail-item">
              <label>Category</label>
              <span>{detailProduct.categoryName || "—"}</span>
            </div>
            <div className="detail-item">
              <label>Supplier</label>
              <span>{detailProduct.supplierName || "—"}</span>
            </div>
            <div className="detail-item">
              <label>Unit Price</label>
              <span>{formatCurrency(detailProduct.unitPrice)}</span>
            </div>
            <div className="detail-item">
              <label>Current Stock</label>
              <span>
                {detailProduct.currentStock <= detailProduct.reorderThreshold ? (
                  <span className="badge badge-low-stock">{detailProduct.currentStock}</span>
                ) : (
                  detailProduct.currentStock
                )}
              </span>
            </div>
            <div className="detail-item">
              <label>Reorder Threshold</label>
              <span>{detailProduct.reorderThreshold}</span>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <span>{formatDateTime(detailProduct.createdAt)}</span>
            </div>
            <div className="detail-item">
              <label>Last Modified</label>
              <span>{formatDateTime(detailProduct.lastModifiedAt)}</span>
            </div>
            {detailProduct.description && (
              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <span>{detailProduct.description}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Stock History Modal */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Stock History — ${historyProduct?.productName || ""}`}
        size="lg"
        footer={<button className="btn btn-outline" onClick={() => setHistoryOpen(false)}>Close</button>}
      >
        {historyRecords.length === 0 ? (
          <p style={{ color: "var(--color-neutral)", textAlign: "center", padding: "2rem 0" }}>
            No stock transactions found for this product.
          </p>
        ) : (
          <div className="table-wrapper" style={{ border: "none", boxShadow: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {historyRecords.map((t) => (
                  <tr key={t.stockTransactionSid}>
                    <td>{formatDateTime(t.transactionDate)}</td>
                    <td>
                      <span className={`badge ${t.transactionType === "IN" ? "badge-in" : "badge-out"}`}>
                        {t.transactionType === "IN" ? "Stock In" : "Stock Out"}
                      </span>
                    </td>
                    <td>{t.quantity}</td>
                    <td>{t.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteSid(null); }}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        loading={deleting}
      />

      {/* Quick Stock Adjust Modal */}
      <Modal
        isOpen={quickStockOpen}
        onClose={() => setQuickStockOpen(false)}
        title={`Quick ${quickStockType === "IN" ? "Stock In" : "Stock Out"} — ${quickStockProduct?.productName ?? ""}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setQuickStockOpen(false)} disabled={quickStockSaving}>Cancel</button>
            <button
              className={`btn ${quickStockType === "IN" ? "btn-success" : "btn-primary"}`}
              onClick={handleQuickStockSave}
              disabled={quickStockSaving || quickStockQty <= 0}
            >
              {quickStockSaving ? "Saving..." : quickStockType === "IN" ? "Add Stock" : "Remove Stock"}
            </button>
          </>
        }
      >
        {quickStockProduct && (
          <div className="form-grid">
            <div className="alert-banner" style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info)", borderLeft: "3px solid var(--color-info)" }}>
              <span>Current stock: <strong>{quickStockProduct.currentStock}</strong> units &nbsp;·&nbsp; Reorder threshold: <strong>{quickStockProduct.reorderThreshold}</strong></span>
            </div>
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <select className="form-select" value={quickStockType} onChange={(e) => setQuickStockType(e.target.value as "IN" | "OUT")}>
                <option value="IN">Stock In (Add)</option>
                <option value="OUT">Stock Out (Remove)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity <span className="required">*</span></label>
              <input
                className="form-input"
                type="number"
                min="1"
                max={quickStockType === "OUT" ? quickStockProduct.currentStock : undefined}
                value={quickStockQty}
                onChange={(e) => setQuickStockQty(Math.max(1, parseInt(e.target.value) || 1))}
              />
              {quickStockType === "OUT" ? (
                <span className="form-hint" style={{ color: quickStockQty > quickStockProduct.currentStock ? "var(--color-danger)" : "var(--color-info)" }}>
                  Available: <strong>{quickStockProduct.currentStock}</strong> units · After removal: <strong>{quickStockProduct.currentStock - quickStockQty}</strong>
                  {quickStockQty > quickStockProduct.currentStock && " ⚠ Exceeds available stock"}
                </span>
              ) : (
                <span className="form-hint">After addition: <strong>{quickStockProduct.currentStock + quickStockQty}</strong> units</span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={quickStockNotes}
                onChange={(e) => setQuickStockNotes(e.target.value)}
                placeholder="Optional notes for this adjustment"
                rows={2}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}