import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type { AuthUser } from "@/features/auth/types";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

export const registerUser = createAsyncThunk<
  { message: string },
  { name: string; email: string; password: string },
  { rejectValue: string }
>("auth/register", async (input, { rejectWithValue }) => {
  try {
    return await apiRequest<{ message: string }>("/api/auth/register", {
      method: "POST",
      body: input,
    });
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Registration failed."));
  }
});

export const loginUser = createAsyncThunk<
  { user: AuthUser },
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async (input, { rejectWithValue }) => {
  try {
    return await apiRequest<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: input,
    });
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Login failed."));
  }
});

export const verifyEmail = createAsyncThunk<{ verified: boolean }, string, { rejectValue: string }>(
  "auth/verifyEmail",
  async (token, { rejectWithValue }) => {
    try {
      return await apiRequest<{ verified: boolean }>("/api/auth/verify-email", {
        method: "POST",
        body: { token },
      });
    } catch (error) {
      return rejectWithValue(errorMessage(error, "Verification failed."));
    }
  }
);

export const forgotPassword = createAsyncThunk<
  { message: string },
  { email: string },
  { rejectValue: string }
>("auth/forgotPassword", async (input, { rejectWithValue }) => {
  try {
    return await apiRequest<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: input,
    });
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Failed to send reset email."));
  }
});

export const resendVerification = createAsyncThunk<
  { message: string },
  { email: string },
  { rejectValue: string }
>("auth/resendVerification", async (input, { rejectWithValue }) => {
  try {
    return await apiRequest<{ message: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: input,
    });
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Failed to send a verification email."));
  }
});

export const resetPassword = createAsyncThunk<
  { reset: boolean },
  { token: string; password: string },
  { rejectValue: string }
>("auth/resetPassword", async (input, { rejectWithValue }) => {
  try {
    return await apiRequest<{ reset: boolean }>("/api/auth/reset-password", {
      method: "POST",
      body: input,
    });
  } catch (error) {
    return rejectWithValue(errorMessage(error, "Failed to reset password."));
  }
});

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  return true;
});

/** Runs once on app shell mount to restore session state after a page reload. */
export const bootstrapSession = createAsyncThunk<AuthUser | null>(
  "auth/bootstrap",
  async () => {
    try {
      const { user } = await apiRequest<{ user: AuthUser }>("/api/auth/session");
      return user;
    } catch {
      return null;
    }
  }
);
