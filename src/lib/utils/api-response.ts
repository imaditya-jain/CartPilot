import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ValidationError as YupValidationError } from "yup";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Converts any thrown value into a safe JSON error response.
 * Never leaks stack traces, internal error messages, or sensitive details to the client —
 * unexpected errors are logged server-side and returned as a generic 500.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return fail(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request");
  }
  if (error instanceof YupValidationError) {
    return fail(400, "VALIDATION_ERROR", error.errors[0] ?? error.message);
  }
  console.error("Unhandled API error:", error);
  return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}
