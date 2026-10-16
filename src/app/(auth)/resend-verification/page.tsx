"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { useAppDispatch } from "@/store/hooks";
import { resendVerification } from "@/features/auth/authThunks";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/auth-shell";

export default function ResendVerificationPage() {
  const dispatch = useAppDispatch();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: yupResolver(forgotPasswordSchema) });

  const onSubmit = async (input: ForgotPasswordInput) => {
    setServerError(null);
    const result = await dispatch(resendVerification(input));
    if (resendVerification.fulfilled.match(result)) {
      setSubmitted(result.payload.message);
    } else {
      setServerError(result.payload ?? "Failed to send a verification email.");
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Check your inbox" subtitle={submitted}>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Resend verification email" subtitle="Enter the email address you used to register.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" hasError={!!errors.email} {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Send verification link
        </Button>
      </form>
      <Link href="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to login
      </Link>
    </AuthShell>
  );
}
