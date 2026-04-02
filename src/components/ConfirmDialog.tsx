"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="confirm-icon confirm-icon-danger">
        <AlertTriangle size={28} />
      </div>
      <div className="confirm-text">
        <h4>{title}</h4>
        <p>{message}</p>
      </div>
      <div className="confirm-actions">
        <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm} type="button" disabled={loading}>
          {loading ? "Deleting..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
