export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export const API_ENDPOINTS = {
  PRODUCTS: {
    LIST: "/api/products",
    BY_SID: (sid: string) => `/api/products/${sid}`,
    ADD: "/api/products/AddProduct",
    UPDATE: (sid: string) => `/api/products/UpdateProduct/${sid}`,
    DELETE: (sid: string) => `/api/products/${sid}`,
    LOW_STOCK: "/api/products/LowStock",
    DDL: "/api/products/DDLProduct",
    FORECAST: (sid: string, leadTimeDays: number, safetyStockDays: number) =>
      `/api/products/${sid}/forecast?leadTimeDays=${leadTimeDays}&safetyStockDays=${safetyStockDays}`,
  },
  CATEGORIES: {
    LIST: "/api/categories",
    BY_SID: (sid: string) => `/api/categories/${sid}`,
    ADD: "/api/categories/AddCategory",
    UPDATE: (sid: string) => `/api/categories/UpdateCategory/${sid}`,
    DELETE: (sid: string) => `/api/categories/${sid}`,
    DDL: "/api/categories/DDLCategory",
  },
  SUPPLIERS: {
    LIST: "/api/suppliers",
    BY_SID: (sid: string) => `/api/suppliers/${sid}`,
    ADD: "/api/suppliers/AddSupplier",
    UPDATE: (sid: string) => `/api/suppliers/UpdateSupplier/${sid}`,
    DELETE: (sid: string) => `/api/suppliers/${sid}`,
    DDL: "/api/suppliers/DDLSupplier",
  },
  USERS: {
    LIST: "/api/users",
    BY_SID: (sid: string) => `/api/users/${sid}`,
    BY_EMAIL: (email: string) => `/api/users/Email/${email}`,
    ADD: "/api/users/AddUser",
    UPDATE: (sid: string) => `/api/users/UpdateUser/${sid}`,
    DELETE: (sid: string) => `/api/users/${sid}`,
  },
  STOCK_TRANSACTIONS: {
    LIST: "/api/stocktransactions",
    BY_SID: (sid: string) => `/api/stocktransactions/${sid}`,
    ADD: "/api/stocktransactions/AddTransaction",
    PRODUCT_HISTORY: (productSid: string) =>
      `/api/stocktransactions/ProductHistory/${productSid}`,
  },
};
