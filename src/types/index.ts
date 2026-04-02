// ==================== Enums & Constants ====================

export enum StatusEnum {
  Active = 1,
  Deleted = 3,
}

export const StatusLabels: Record<number, string> = {
  [StatusEnum.Active]: "Active",
  [StatusEnum.Deleted]: "Deleted",
};

export type TransactionType = "IN" | "OUT";

// ==================== Request Models ====================

export interface SearchRequestModel {
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortOrder?: string;
  search?: string;
  transactionType?: string;
}

export interface ProductRequestModel {
  productName: string;
  sku: string;
  description?: string;
  categorySid?: string;
  supplierSid?: string;
  unitPrice: number;
  currentStock: number;
  reorderThreshold: number;
}

export interface CategoryRequestModel {
  categoryName: string;
  description?: string;
}

export interface SupplierRequestModel {
  supplierName: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
}

export interface UserRequestModel {
  fullName: string;
  email: string;
  role: string;
}

export interface StockTransactionRequestModel {
  productSid: string;
  transactionType: TransactionType;
  quantity: number;
  notes?: string;
}

// ==================== Response Models ====================

export interface ProductResponseModel {
  productSid: string;
  productName: string;
  sku: string;
  description: string | null;
  categoryName: string | null;
  supplierName: string | null;
  unitPrice: number;
  currentStock: number;
  reorderThreshold: number;
  status: number;
  createdAt: string;
  lastModifiedAt: string | null;
}

export interface CategoryResponseModel {
  categorySid: string;
  categoryName: string;
  description: string | null;
  status: number;
  createdAt: string;
  lastModifiedAt: string | null;
}

export interface SupplierResponseModel {
  supplierSid: string;
  supplierName: string;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  status: number;
  createdAt: string;
  lastModifiedAt: string | null;
}

export interface UserResponseModel {
  userSid: string;
  fullName: string;
  email: string;
  role: string;
  status: number;
  createdAt: string;
  lastModifiedAt: string | null;
}

export interface StockTransactionResponseModel {
  stockTransactionSid: string;
  productSid: string;
  productName: string;
  transactionType: string;
  quantity: number;
  notes: string | null;
  transactionDate: string;
  status: number;
  createdAt: string;
  lastModifiedAt: string | null;
}

// ==================== Page Response ====================

export interface PageMetadata {
  page?: number;
  page_size?: number;
  key?: string;
  url?: string;
  first_page_url?: string;
  previous_page_url?: string | null;
  next_page_url?: string | null;
  total_results?: number;
  total_page_num?: number;
  total_pages?: number;
  extra_data?: unknown[];
  next_page_exists?: boolean;
}

export interface PageResponse<T> {
  // New API format
  meta?: PageMetadata;
  result?: T[];
  // Legacy formats
  records?: T[];
  Records?: T[];
  pageNumber?: number;
  pageSize?: number;
  title?: string;
  totalRecords?: number;
  totalCount?: number;
  count?: number;
  total_results?: number;
}

// ==================== Dropdown ====================

export interface SelectListItem {
  value: string;
  text: string;
}

// ==================== Validation ====================

export interface FieldErrors {
  [key: string]: string;
}

export interface TouchedFields {
  [key: string]: boolean;
}
