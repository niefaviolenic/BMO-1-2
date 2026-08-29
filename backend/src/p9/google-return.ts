export const DEFAULT_GOOGLE_CLIENT_RETURN = "joymobile://auth/callback";

/**
 * Checks if an IP or hostname is a safe development host:
 * - localhost or 127.0.0.1
 * - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Tailscale CGNAT range (100.64.0.0/10)
 */
function isPrivateOrDevHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  // IPv4 regex check
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4Match) {
    const aStr = ipv4Match[1];
    const bStr = ipv4Match[2];
    const cStr = ipv4Match[3];
    const dStr = ipv4Match[4];
    if (!aStr || !bStr || !cStr || !dStr) return false;

    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    const c = parseInt(cStr, 10);
    const d = parseInt(dStr, 10);
    if (a > 255 || b > 255 || c > 255 || d > 255) return false;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (Tailscale CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * Validates and strictly sanitizes the return URL for Google OAuth callback.
 * 
 * Prevents OAuth open redirect attacks:
 * 1. Native app custom scheme: MUST be hostname === "auth" and pathname === "/callback" (joymobile://auth/callback).
 * 2. Expo Go dev schemes (exp:// or exps://): MUST target private/dev host and pathname === "/--/auth/callback" or "/auth/callback".
 * 3. Local web dev (http:// or https://): MUST be localhost/127.0.0.1 and pathname === "/auth/callback".
 * 
 * Any violation, extra credentials, or unexpected host/path falls back strictly to DEFAULT_GOOGLE_CLIENT_RETURN.
 */
export function sanitizeGoogleClientReturnUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return DEFAULT_GOOGLE_CLIENT_RETURN;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return DEFAULT_GOOGLE_CLIENT_RETURN;
  }
  if (parsed.username || parsed.password) {
    return DEFAULT_GOOGLE_CLIENT_RETURN;
  }

  // 1. Native app custom scheme
  if (parsed.protocol === "joymobile:") {
    if (parsed.hostname === "auth" && (parsed.pathname === "/callback" || parsed.pathname === "")) {
      return parsed.toString();
    }
    return DEFAULT_GOOGLE_CLIENT_RETURN;
  }

  // 2. Expo Go dev schemes (exp:// or exps://)
  if (parsed.protocol === "exp:" || parsed.protocol === "exps:") {
    const isAllowedPath = parsed.pathname === "/--/auth/callback" || parsed.pathname === "/auth/callback";
    if (isAllowedPath && isPrivateOrDevHost(parsed.hostname)) {
      return parsed.toString();
    }
    return DEFAULT_GOOGLE_CLIENT_RETURN;
  }

  // 3. Local web dev only
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && (parsed.pathname === "/auth/callback" || parsed.pathname === "/--/auth/callback")) {
      return parsed.toString();
    }
  }

  // Reject all other arbitrary hosts / protocols
  return DEFAULT_GOOGLE_CLIENT_RETURN;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

export function googleClientReturnHtml(targetUrl: string, ok: boolean, errorDetail?: string): string {
  const safeUrl = sanitizeGoogleClientReturnUrl(targetUrl);
  const href = escapeHtml(safeUrl);
  const message = ok ? "Google Sign-In successful. Returning to Joy..." : "Google Sign-In failed. Returning to Joy...";
  const isFailed = ok === false;
  const extra = isFailed && errorDetail ? `<p style="color:#f85149;margin-top:8px;">${escapeHtml(errorDetail)}</p>` : "";
  const serializedScriptUrl = JSON.stringify(safeUrl).replace(/</gu, "\\u003c");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Joy — Google Sign-In</title><meta http-equiv="refresh" content="0;url=${href}"><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#c9d1d9;text-align:center}a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}p{font-size:14px;color:#8b949e}</style></head><body><div><h2>${message}</h2>${extra}<p><a href="${href}">Click here if not redirected automatically</a></p></div><script>window.location.href=${serializedScriptUrl};</script></body></html>`;
}
