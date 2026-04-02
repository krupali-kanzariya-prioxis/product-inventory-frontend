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
  UserResponseModel,
  UserRequestModel,
  FieldErrors,
  TouchedFields,
} from "@/types";
import { formatDate, exportToCSV, validateEmail } from "@/utils/helpers";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const ROLES = ["Admin", "Manager", "User", "Viewer"];

const emptyForm: UserRequestModel = {
  fullName: "",
  email: "",
  role: "User",
};

export default function UsersPage() {
  const [records, setRecords] = useState<UserResponseModel[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSid, setEditingSid] = useState<string | null>(null);
  const [form, setForm] = useState<UserRequestModel>({ ...emptyForm });
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
      const data = await apiGet<PageResponse<UserResponseModel>>(`${API_ENDPOINTS.USERS.LIST}${params}`);
      const fetched = getPageRecords<UserResponseModel>(data);
      setRecords(fetched);
      setTotalRecords(getPageTotal(data, fetched.length));
    } catch {
      toast.error("Failed to load users");
    }
  }, [page, pageSize, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function validate(f: UserRequestModel): FieldErrors {
    const e: FieldErrors = {};
    if (!f.fullName.trim()) e.fullName = "Full name is required";
    else if (f.fullName.trim().length < 2) e.fullName = "Must be at least 2 characters";
    else if (f.fullName.trim().length > 200) e.fullName = "Must be 200 characters or less";
    if (!f.email.trim()) e.email = "Email is required";
    else if (!validateEmail(f.email.trim())) e.email = "Invalid email format";
    if (!f.role.trim()) e.role = "Role is required";
    return e;
  }

  function handleFieldChange(field: keyof UserRequestModel, value: string) {
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
      const data = await apiGet<UserResponseModel>(API_ENDPOINTS.USERS.BY_SID(sid));
      setForm({
        fullName: data.fullName,
        email: data.email,
        role: data.role,
      });
      setEditingSid(sid);
      setErrors({});
      setTouched({});
      setSubmitAttempt(false);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load user");
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
        await apiPost(API_ENDPOINTS.USERS.UPDATE(editingSid), form);
        toast.success("User updated successfully");
      } else {
        await apiPost(API_ENDPOINTS.USERS.ADD, form);
        toast.success("User added successfully");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteSid) return;
    setDeleting(true);
    try {
      await apiDelete(API_ENDPOINTS.USERS.DELETE(deleteSid));
      toast.success("User deleted successfully");
      setDeleteOpen(false);
      setDeleteSid(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    exportToCSV(records as unknown as Record<string, unknown>[], "users", [
      { key: "fullName", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "createdAt", label: "Created At" },
    ]);
  }

  return (
    <>
      <div className="page-header">
        <h2>Users</h2>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExport}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created At</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No users found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.userSid}>
                  <td style={{ fontWeight: 600 }}>{r.fullName}</td>
                  <td>{r.email}</td>
                  <td>
                    <span className="badge" style={{ background: "rgba(63,70,116,0.1)", color: "var(--color-primary)" }}>
                      {r.role}
                    </span>
                  </td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td className="col-actions">
                    <button className="btn btn-ghost btn-icon-edit" title="Edit" onClick={() => openEdit(r.userSid)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon-delete" title="Delete" onClick={() => { setDeleteSid(r.userSid); setDeleteOpen(true); }}>
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
        title={editingSid ? "Edit User" : "Add User"}
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
            <label className="form-label">Full Name <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.fullName || submitAttempt) && errors.fullName ? "form-input-error" : ""}`}
              value={form.fullName}
              onChange={(e) => handleFieldChange("fullName", e.target.value)}
              onBlur={() => handleBlur("fullName")}
              placeholder="Enter full name"
            />
            {(touched.fullName || submitAttempt) && errors.fullName && <span className="form-error">{errors.fullName}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Email <span className="required">*</span></label>
            <input
              className={`form-input ${(touched.email || submitAttempt) && errors.email ? "form-input-error" : ""}`}
              type="email"
              value={form.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              placeholder="Enter email address"
            />
            {(touched.email || submitAttempt) && errors.email && <span className="form-error">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Role <span className="required">*</span></label>
            <select
              className={`form-select ${(touched.role || submitAttempt) && errors.role ? "form-select-error" : ""}`}
              value={form.role}
              onChange={(e) => handleFieldChange("role", e.target.value)}
              onBlur={() => handleBlur("role")}
            >
              <option value="">— Select Role —</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {(touched.role || submitAttempt) && errors.role && <span className="form-error">{errors.role}</span>}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteSid(null); }}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        loading={deleting}
      />
    </>
  );
}