"use client";

import { GoogleIcon, MicrosoftIcon } from "@/features/auth/components/auth-icons";

export type AuthProvider = "google" | "azure";

type AuthDividerProps = {
  className?: string;
};

type AuthSocialButtonsProps = {
  isCompact?: boolean;
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
  isCompact = false,
  oauthProvider,
  onProviderClick
}: AuthSocialButtonsProps) {
  return (
    <div className={isCompact ? "space-y-3" : "space-y-4"}>
      <button
        className={`login-social flex w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70 ${isCompact ? "h-10 text-sm" : "h-14 text-base"}`}
        type="button"
        disabled={oauthProvider !== null}
        onClick={() => onProviderClick("google")}
      >
        <GoogleIcon />
        {oauthProvider === "google"
          ? "Opening Google..."
          : "Continue with Google"}
      </button>

      <button
        className={`login-social flex w-full items-center justify-center gap-4 border border-[#E5E0D6] bg-white font-bold text-[#0F172A] transition hover:border-[#1f4d73] hover:bg-[#F7F4ED] disabled:cursor-not-allowed disabled:opacity-70 ${isCompact ? "h-10 text-sm" : "h-14 text-base"}`}
        type="button"
        disabled={oauthProvider !== null}
        onClick={() => onProviderClick("azure")}
      >
        <MicrosoftIcon />
        {oauthProvider === "azure"
          ? "Opening Microsoft..."
          : "Continue with Microsoft"}
      </button>
    </div>
  );
}
