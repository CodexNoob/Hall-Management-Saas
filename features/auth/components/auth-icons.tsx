"use client";

type IconProps = {
  className?: string;
};

const defaultInputIconClass = "h-5 w-5 text-[#64748B]";

export function UserIcon({ className = defaultInputIconClass }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function EmailIcon({ className = defaultInputIconClass }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 6h16v12H4zM4 6l8 7 8-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function PhoneIcon({ className = defaultInputIconClass }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 4 4.5 6.5c-.6.6-.7 1.5-.3 2.3 2.3 4.8 6.2 8.7 11 11 .8.4 1.7.3 2.3-.3L20 17l-4-3-2 2c-2.5-1.1-4.5-3.1-5.6-5.6l2-2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function BuildingIcon({
  className = defaultInputIconClass
}: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 21h16M6 21V7l6-3 6 3v14M9 10h2M13 10h2M9 14h2M13 14h2M9 18h2M13 18h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function LockIcon({ className = defaultInputIconClass }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6zM12 14v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function EyeIcon({
  className = "h-5 w-5",
  isVisible
}: IconProps & { isVisible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      {isVisible ? (
        <>
          <path
            d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      ) : (
        <path
          d="M3 12s3.5-6 9-6c2 0 3.8.8 5.2 1.8M21 12s-3.5 6-9 6c-2 0-3.8-.8-5.2-1.8M4 4l16 16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

export function ArrowLoginIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M10 7 15 12l-5 5M15 12H3M14 4h5v16h-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function ShieldIcon({
  className = "h-7 w-7 text-[#1f4d73]"
}: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m8.5 12 2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function SendIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m21 3-8.5 18-3-7-6.5-3zM21 3 9.5 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function ExternalLinkIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function GoogleIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c3 0 5.5-1 7.4-2.6l-3.6-2.8c-1 .7-2.3 1-3.8 1-2.9 0-5.3-1.9-6.1-4.5H2.2V17A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7H2.2a11 11 0 0 0 0 10l3.7-2.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A10.8 10.8 0 0 0 12 1 11 11 0 0 0 2.2 7l3.7 2.9c.8-2.6 3.2-4.5 6.1-4.5Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function MicrosoftIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path d="M3 3h8.5v8.5H3z" fill="#F35325" />
      <path d="M12.5 3H21v8.5h-8.5z" fill="#81BC06" />
      <path d="M3 12.5h8.5V21H3z" fill="#05A6F0" />
      <path d="M12.5 12.5H21V21h-8.5z" fill="#FFBA08" />
    </svg>
  );
}
