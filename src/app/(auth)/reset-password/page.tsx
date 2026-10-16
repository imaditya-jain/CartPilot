"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { useAppDispatch } from "@/store/hooks";
import { resetPassword } from "@/features/auth/authThunks";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/auth-shell";
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { token: token ?? "" },
  });

  if (!token) {
    return (
      <AuthShell title="Reset password">
        <p className="text-sm text-danger">This password reset link is missing its token.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Password updated">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
          <p className="text-sm text-foreground">
            Your password has been reset. You&apos;ve been signed out everywhere for security —
            log in again with your new password.
          </p>
          <Button className="mt-2 w-full" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        </div>
      </AuthShell>
    );
  }

  const onSubmit = async (input: ResetPasswordInput) => {
    setServerError(null);
    const result = await dispatch(resetPassword({ token: input.token, password: input.password }));
    if (resetPassword.fulfilled.match(result)) {
      setSuccess(true);
    } else {
      setServerError(result.payload ?? "Failed to reset password.");
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Pick a strong password you haven't used before.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <input type="hidden" {...register("token")} />
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            hasError={!!errors.password}
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
