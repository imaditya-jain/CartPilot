"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { useAppDispatch } from "@/store/hooks";
import { loginUser } from "@/features/auth/authThunks";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { AuthShell } from "@/components/layout/auth-shell";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: yupResolver(loginSchema) });

  const onSubmit = async (input: LoginInput) => {
    setServerError(null);
    const result = await dispatch(loginUser(input));
    if (loginUser.fulfilled.match(result)) {
      router.push(searchParams.get("next") ?? "/dashboard");
    } else {
      setServerError(result.payload ?? "Login failed.");
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your CartPilot AI dashboard.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            autoComplete="current-password"
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
          Log in
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
