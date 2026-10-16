"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { useAppDispatch } from "@/store/hooks";
import { registerUser } from "@/features/auth/authThunks";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/auth-shell";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: yupResolver(registerSchema) });

  const onSubmit = async (input: RegisterInput) => {
    setServerError(null);
    const result = await dispatch(registerUser(input));
    if (registerUser.fulfilled.match(result)) {
      setSubmitted(result.payload.message);
    } else {
      setServerError(result.payload ?? "Registration failed.");
    }
  };

  if (submitted) {
    return (
      <AuthShell title="Check your inbox" subtitle={submitted}>
        <Link href="/resend-verification" className="mb-3 block text-sm font-medium text-primary hover:underline">
          Didn’t receive the email? Send another link
        </Link>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start connecting your Shopify store in minutes.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" hasError={!!errors.name} {...register("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" hasError={!!errors.email} {...register("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            hasError={!!errors.password}
            {...register("password")}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
        <Link href="/resend-verification" className="font-medium text-primary hover:underline">
          Resend a verification email
        </Link>
      </p>
    </AuthShell>
  );
}
