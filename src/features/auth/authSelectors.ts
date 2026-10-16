import type { RootState } from "@/store";

export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectIsAuthenticated = (state: RootState) => state.auth.status === "authenticated";
export const selectAuthBootstrapped = (state: RootState) => state.auth.bootstrapped;
export const selectAuthError = (state: RootState) => state.auth.error;
