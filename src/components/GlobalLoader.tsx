"use client";

import { useEffect, useState } from "react";
import { subscribeLoading } from "@/services/api.service";

export default function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return subscribeLoading(setIsLoading);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="loader-backdrop">
      <div className="loader-spinner" />
    </div>
  );
}
