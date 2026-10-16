"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { bootstrapSession } from "@/features/auth/authThunks";
import { selectIsAuthenticated } from "@/features/auth/authSelectors";
import { apiRequest } from "@/lib/api-client";

/** Access tokens are short-lived (default 15 min); refresh proactively so an open tab stays
 * signed in without waiting for a 401 round-trip on the next request. */
const PROACTIVE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SessionBootstrap() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      apiRequest("/api/auth/refresh", { method: "POST" }).catch(() => undefined);
    }, PROACTIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return null;
}
