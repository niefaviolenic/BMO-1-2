import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOOGLE_CLIENT_RETURN,
  sanitizeGoogleClientReturnUrl,
  googleClientReturnHtml,
} from "../../src/p9/google-return.js";

describe("sanitizeGoogleClientReturnUrl", () => {
  it("allows valid exact joymobile scheme URLs with query params", () => {
    expect(sanitizeGoogleClientReturnUrl("joymobile://auth/callback")).toBe("joymobile://auth/callback");
    expect(sanitizeGoogleClientReturnUrl("joymobile://auth/callback?code=abc12345")).toBe("joymobile://auth/callback?code=abc12345");
  });

  it("rejects joymobile URLs with wrong host or path", () => {
    expect(sanitizeGoogleClientReturnUrl("joymobile://evil/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("joymobile://auth/wrongpath")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("joymobile://evil.com")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
  });

  it("allows Expo Go exp/exps scheme URLs for private dev hosts with exact path", () => {
    expect(sanitizeGoogleClientReturnUrl("exp://192.168.1.100:8081/--/auth/callback")).toBe("exp://192.168.1.100:8081/--/auth/callback");
    expect(sanitizeGoogleClientReturnUrl("exp://100.107.88.120:8081/--/auth/callback")).toBe("exp://100.107.88.120:8081/--/auth/callback");
    expect(sanitizeGoogleClientReturnUrl("exps://127.0.0.1:8081/auth/callback")).toBe("exps://127.0.0.1:8081/auth/callback");
  });

  it("rejects Expo Go exp URLs with public hosts or wrong paths", () => {
    expect(sanitizeGoogleClientReturnUrl("exp://evil.example.com:8081/--/auth/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("exp://8.8.8.8:8081/--/auth/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("exp://192.168.1.100:8081/wrong/path")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
  });

  it("allows localhost web development URLs with exact path", () => {
    expect(sanitizeGoogleClientReturnUrl("http://localhost:3000/auth/callback")).toBe("http://localhost:3000/auth/callback");
    expect(sanitizeGoogleClientReturnUrl("http://127.0.0.1:8081/auth/callback")).toBe("http://127.0.0.1:8081/auth/callback");
  });

  it("rejects open redirect attempts to arbitrary external domains", () => {
    expect(sanitizeGoogleClientReturnUrl("https://evil.example/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("http://attacker.com/steal")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("https://api.attacker.com")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
  });

  it("rejects URLs with embedded credentials (user:pass)", () => {
    expect(sanitizeGoogleClientReturnUrl("joymobile://user:pass@auth/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("http://admin:secret@localhost:3000/auth/callback")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
  });

  it("rejects non-string or malformed inputs", () => {
    expect(sanitizeGoogleClientReturnUrl(null)).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl(undefined)).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("not a url ::::")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
    expect(sanitizeGoogleClientReturnUrl("javascript:alert(1)")).toBe(DEFAULT_GOOGLE_CLIENT_RETURN);
  });
});

describe("googleClientReturnHtml", () => {
  it("renders success HTML with safe serialized redirect script and meta refresh", () => {
    const html = googleClientReturnHtml("joymobile://auth/callback?code=test1234", true);
    expect(html).toContain("Google Sign-In successful");
    expect(html).toContain("joymobile://auth/callback?code=test1234");
    expect(html).toContain("meta http-equiv=\"refresh\"");
    expect(html).toContain("window.location.href=\"joymobile://auth/callback?code=test1234\"");
  });

  it("safely sanitizes and prevents XSS payload in return URL or error", () => {
    const malicious = "joymobile://auth/callback?</script><script>alert(1)</script>";
    const html = googleClientReturnHtml(malicious, false, "</script><script>alert('xss')</script>");
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("&lt;/script&gt;&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });
});
