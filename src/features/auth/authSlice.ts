import { createSlice } from "@reduxjs/toolkit";
import type { AuthState } from "@/features/auth/types";
import { registerUser, loginUser, logoutUser, bootstrapSession, verifyEmail } from "@/features/auth/authThunks";

const initialState: AuthState = {
  user: null,
  status: "idle",
  bootstrapped: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = action.payload ?? "Login failed.";
      })
      .addCase(registerUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = "unauthenticated";
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = action.payload ?? "Registration failed.";
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.error = action.payload ?? "Verification failed.";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.status = "unauthenticated";
      })
      .addCase(bootstrapSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.bootstrapped = true;
        state.user = action.payload;
        state.status = action.payload ? "authenticated" : "unauthenticated";
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.bootstrapped = true;
        state.user = null;
        state.status = "unauthenticated";
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
