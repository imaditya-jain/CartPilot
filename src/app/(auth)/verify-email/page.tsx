"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { verifyEmail } from "@/features/auth/authThunks";
import { AuthShell } from "@/components/layout/auth-shell";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    dispatch(verifyEmail(token)).then((result) => {
      if (verifyEmail.fulfilled.match(result)) {
        setState("success");
      } else {
        setState("error");
        setMessage(result.payload ?? "This verification link is invalid or has expired.");
      }
    });
  }, [dispatch, token]);

  return (
    <AuthShell title="Email verification">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted">Verifying your email…</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
            <p className="text-sm text-foreground">Your email has been verified.</p>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Continue to login
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="h-6 w-6 text-danger" aria-hidden="true" />
            <p className="text-sm text-danger">{message}</p>
            <Link href="/register" className="text-sm font-medium text-primary hover:underline">
              Back to registration
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
