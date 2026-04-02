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
  CategoryResponseModel,
  CategoryRequestModel,
  FieldErrors,
  TouchedFields,
} from "@/types";
import { formatDate, exportToCSV } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const emptyForm: CategoryRequestModel = { categoryName: "", description: "" };

export default function CategoriesPage() {
  const [records, setRecords] = useState<CategoryResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSid, setEditingSid] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryRequestModel>({ ...emptyForm });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitAttempt, setSubmitAttempt] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
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
      const data = await apiGet<PageResponse<CategoryResponseModel>>(`${API_ENDPOINTS.CATEGORIES.LIST}${params}`);
      const fetched = getPageRecords<CategoryResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load categories");
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Validation
  function validate(f: CategoryRequestModel): FieldErrors {
    const e: FieldErrors = {};
    if (!f.categoryName.trim()) e.categoryName = "Category name is required";
    else if (f.categoryName.trim().length < 2) e.categoryName = "Must be at least 2 characters";
    else if (f.categoryName.trim().length > 100) e.categoryName = "Must be 100 characters or less";
    return e;
  }

  function handleFieldChange(field: keyof CategoryRequestModel, value: string) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (touched[field] || submitAttempt) {
      setErrors(validate(updated));
    }
  }

  function handleBlur(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(form));
  }

  // Open modal
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
      const data = await apiGet<CategoryResponseModel>(API_ENDPOINTS.CATEGORIES.BY_SID(sid));
      setForm({ categoryName: data.categoryName, description: data.description || "" });
      setEditingSid(sid);
      setErrors({});
      setTouched({});
      setSubmitAttempt(false);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load category");
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
        await apiPost(API_ENDPOINTS.CATEGORIES.UPDATE(editingSid), form);
        toast.success("Category updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.CATEGORIES.ADD, form);
        toast.success("Category added successfully");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteSid) return;
    setDeleting(true);
    try {
      await apiDelete(API_ENDPOINTS.CATEGORIES.DELETE(deleteSid));
      toast.success("Category deleted successfully");
      setDeleteOpen(false);
      setDeleteSid(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "categories", [
      { key: "categoryName", label: "Category Name" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Created At" },
    ]);
  }

  return (
    <>
      <div className="page-header">
        <h2>Categories</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Category
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Description</th>
              <th>Created At</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No categories found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.categorySid}>
                  <td style={{ fontWeight: 600 }}>{r.categoryName}</td>
                  <td>{r.description || "—"}</td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td className="col-actions">
                    <button className="btn btn-ghost btn-icon-edit" title="Edit" onClick={() => openEdit(r.categorySid)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon-delete" title="Delete" onClick={() => { setDeleteSid(r.categorySid); setDeleteOpen(true); }}>
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSid ? "Edit Category" : "Add Category"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingSid ? "Update" : "Add"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Category Name <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.categoryName || submitAttempt) && errors.categoryName ? "form-input-error" : ""}`}
              value={form.categoryName}
              onChange={(e) => handleFieldChange("categoryName", e.target.value)}
              onBlur={() => handleBlur("categoryName")}
              placeholder="Enter category name"
            />
            {(touched.categoryName || submitAttempt) && errors.categoryName && (
              <span className="form-error">{errors.categoryName}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={form.description || ""}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Enter description (optional)"
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteSid(null); }}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category? This action cannot be undone."
        loading={deleting}
      />
    </>
  );
}