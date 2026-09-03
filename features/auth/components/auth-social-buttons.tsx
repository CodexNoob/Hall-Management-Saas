"use client";

import { GoogleIcon } from "@/features/auth/components/auth-icons";

export type AuthProvider = "google";

/**
 * `sm` is the desktop app's compact shell, `md` the standard web control size,
 * `lg` the oversized one the sign-up card still uses.
 */
export type AuthControlSize = "sm" | "md" | "lg";

const sizeClasses: Record<AuthControlSize, string> = {
  sm: "h-10 text-sm",
  md: "h-11 text-sm",
  lg: "h-14 text-base"
};

type AuthDividerProps = {
  className?: string;
};

type AuthSocialButtonsProps = {
  size?: AuthControlSize;
  oauthProvider: AuthProvider | null;
  onProviderClick: (provider: AuthProvider) => void;
};

export function AuthDivider({ className = "" }: AuthDividerProps) {
  return (
    <div
      className={`${className} flex items-center gap-5 text-sm font-medium text-[#64748B]`}
    >
      <span className="h-px flex-1 bg-[#E5E0D6]" />
      or continue with
      <span className="h-px flex-1 bg-[#E5E0D6]" />
    </div>
  );
}

export function AuthSocialButtons({
  size = "lg",
  oauthProvider,
  onProviderClick
}: AuthSocialButtonsProps) {
  return (
    <div className={size === "lg" ? "space-y-4" : "space-y-3"}>
      <button
        className={`login-social flex w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70 ${sizeClasses[size]}`}
        type="button"
        disabled={oauthProvider !== null}
        onClick={() => onProviderClick("google")}
      >
        <GoogleIcon />
        {oauthProvider === "google"
          ? "Opening Google..."
          : "Continue with Google"}
      </button>
    </div>
  );
}
