import * as yup from "yup";

const passwordRules = (label: string) =>
  yup
    .string()
    .required(`${label} is required`)
    .min(10, `${label} must be at least 10 characters`)
    .max(128, `${label} must be at most 128 characters`)
    .matches(/[a-z]/, `${label} must include a lowercase letter`)
    .matches(/[A-Z]/, `${label} must include an uppercase letter`)
    .matches(/[0-9]/, `${label} must include a number`);

export const registerSchema = yup.object({
  name: yup.string().trim().required("Name is required").max(120, "Name is too long"),
  email: yup.string().trim().lowercase().required("Email is required").email("Enter a valid email address"),
  password: passwordRules("Password"),
});
export type RegisterInput = yup.InferType<typeof registerSchema>;

export const loginSchema = yup.object({
  email: yup.string().trim().lowercase().required("Email is required").email("Enter a valid email address"),
  password: yup.string().required("Password is required"),
});
export type LoginInput = yup.InferType<typeof loginSchema>;

export const verifyEmailSchema = yup.object({
  token: yup.string().required("Verification token is required"),
});
export type VerifyEmailInput = yup.InferType<typeof verifyEmailSchema>;

export const forgotPasswordSchema = yup.object({
  email: yup.string().trim().lowercase().required("Email is required").email("Enter a valid email address"),
});
export type ForgotPasswordInput = yup.InferType<typeof forgotPasswordSchema>;

export const resetPasswordSchema = yup.object({
  token: yup.string().required("Reset token is required"),
  password: passwordRules("Password"),
  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords must match"),
});
export type ResetPasswordInput = yup.InferType<typeof resetPasswordSchema>;

/** The subset of resetPasswordSchema actually sent to the API (confirmPassword is client-only). */
export const resetPasswordApiSchema = yup.object({
  token: yup.string().required("Reset token is required"),
  password: passwordRules("Password"),
});
export type ResetPasswordApiInput = yup.InferType<typeof resetPasswordApiSchema>;
