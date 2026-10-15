type IconProps = React.SVGProps<SVGSVGElement>;

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.5-.23-.36a9.43 9.43 0 0 1-1.44-5.04c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.69 2.77a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.48-9.47 9.48Zm8.05-17.53A11.3 11.3 0 0 0 12.05.63C5.82.63.75 5.7.75 11.93c0 1.99.52 3.94 1.51 5.65L.65 23.4l5.97-1.57a11.3 11.3 0 0 0 5.42 1.38h.01c6.23 0 11.3-5.07 11.3-11.3 0-3.02-1.18-5.86-3.25-7.93Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M13.5 21v-7.5h2.55l.45-3h-3V8.6c0-.87.3-1.45 1.6-1.45H16.6V4.5c-.27-.04-1.2-.12-2.28-.12-2.26 0-3.82 1.38-3.82 3.9v1.22H8v3h2.5V21h3Z" />
    </svg>
  );
}

/** Minimal route mark used in the wordmark. */
export function RouteMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M7 26c0-5 4-6 8-7.5s6-2.5 6-6.5-3-5-6-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="7" cy="26" r="2.6" fill="currentColor" />
      <circle cx="21" cy="6.5" r="2.6" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}
