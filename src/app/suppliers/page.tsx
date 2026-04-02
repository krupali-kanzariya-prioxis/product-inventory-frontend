"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import toast from "react-hot-toast";
import {
  apiGet,
  apiPost,
  apiDelete,
  buildListQuery,
  getPageRecords,
  getPageTotal,
} from "@/services/api.service";
import { API_ENDPOINTS } from "@/config/api.config";
import type {
  PageResponse,
  SupplierResponseModel,
  SupplierRequestModel,
  FieldErrors,
  TouchedFields,
} from "@/types";
import { formatDate, exportToCSV, validateEmail, validatePhone } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const emptyForm: SupplierRequestModel = {
  supplierName: "",
  contactEmail: "",
  phone: "",
  address: "",
};

export default function SuppliersPage() {
  const [records, setRecords] = useState<SupplierResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSid, setEditingSid] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierRequestModel>({ ...emptyForm });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitAttempt, setSubmitAttempt] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSid, setDeleteSid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = buildListQuery({
        page,
        pageSize,
        sortColumn: "lastModifiedAt",
        sortOrder: "DESC",
        search,
      });
      const data = await apiGet<PageResponse<SupplierResponseModel>>(`${API_ENDPOINTS.SUPPLIERS.LIST}${params}`);
      const fetched = getPageRecords<SupplierResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load suppliers");
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function validate(f: SupplierRequestModel): FieldErrors {
    const e: FieldErrors = {};
    if (!f.supplierName.trim()) e.supplierName = "Supplier name is required";
    else if (f.supplierName.trim().length < 2) e.supplierName = "Must be at least 2 characters";
    else if (f.supplierName.trim().length > 200) e.supplierName = "Must be 200 characters or less";
    if (f.contactEmail && f.contactEmail.trim() && !validateEmail(f.contactEmail.trim()))
      e.contactEmail = "Invalid email format";
    if (f.phone && f.phone.trim() && !validatePhone(f.phone.trim()))
      e.phone = "Invalid phone format";
    return e;
  }

  function handleFieldChange(field: keyof SupplierRequestModel, value: string) {
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
      const data = await apiGet<SupplierResponseModel>(API_ENDPOINTS.SUPPLIERS.BY_SID(sid));
      setForm({
        supplierName: data.supplierName,
        contactEmail: data.contactEmail || "",
        phone: data.phone || "",
        address: data.address || "",
      });
      setEditingSid(sid);
      setErrors({});
      setTouched({});
      setSubmitAttempt(false);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load supplier");
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
        await apiPost(API_ENDPOINTS.SUPPLIERS.UPDATE(editingSid), form);
        toast.success("Supplier updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.SUPPLIERS.ADD, form);
        toast.success("Supplier added successfully");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteSid) return;
    setDeleting(true);
    try {
      await apiDelete(API_ENDPOINTS.SUPPLIERS.DELETE(deleteSid));
      toast.success("Supplier deleted successfully");
      setDeleteOpen(false);
      setDeleteSid(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete supplier");
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "suppliers", [
      { key: "supplierName", label: "Supplier Name" },
      { key: "contactEmail", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "createdAt", label: "Created At" },
    ]);
  }

  return (
    <>
      <div className="page-header">
        <h2>Suppliers</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Created At</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No suppliers found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.supplierSid}>
                  <td style={{ fontWeight: 600 }}>{r.supplierName}</td>
                  <td>{r.contactEmail || "—"}</td>
                  <td>{r.phone || "—"}</td>
                  <td>{r.address || "—"}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td className="col-actions">
                    <button className="btn btn-ghost btn-icon-edit" title="Edit" onClick={() => openEdit(r.supplierSid)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon-delete" title="Delete" onClick={() => { setDeleteSid(r.supplierSid); setDeleteOpen(true); }}>
                      <Trash2 size={16} />
                    </button>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSid ? "Edit Supplier" : "Add Supplier"}
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
            <label className="form-label">Supplier Name <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.supplierName || submitAttempt) && errors.supplierName ? "form-input-error" : ""}`}
              value={form.supplierName}
              onChange={(e) => handleFieldChange("supplierName", e.target.value)}
              onBlur={() => handleBlur("supplierName")}
              placeholder="Enter supplier name"
            />
            {(touched.supplierName || submitAttempt) && errors.supplierName && (
              <span className="form-error">{errors.supplierName}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input
              className={`form-input ${(touched.contactEmail || submitAttempt) && errors.contactEmail ? "form-input-error" : ""}`}
              type="email"
              value={form.contactEmail || ""}
              onChange={(e) => handleFieldChange("contactEmail", e.target.value)}
              onBlur={() => handleBlur("contactEmail")}
              placeholder="Email address"
            />
            {(touched.contactEmail || submitAttempt) && errors.contactEmail && (
              <span className="form-error">{errors.contactEmail}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className={`form-input ${(touched.phone || submitAttempt) && errors.phone ? "form-input-error" : ""}`}
              value={form.phone || ""}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              onBlur={() => handleBlur("phone")}
              placeholder="Phone number"
            />
            {(touched.phone || submitAttempt) && errors.phone && (
              <span className="form-error">{errors.phone}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              value={form.address || ""}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="Address"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteSid(null); }}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        loading={deleting}
      />
    </>
  );
}