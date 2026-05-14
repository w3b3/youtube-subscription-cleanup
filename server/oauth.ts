import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { db } from "./db.js";

const SCOPES = ["https://www.googleapis.com/auth/youtube", "openid", "email"];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getRedirectUri(): string {
  const port = process.env.PORT ?? "8787";
  return `http://localhost:${port}/api/auth/callback`;
}

export function makeOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    getRedirectUri()
  );
}

export function buildAuthUrl(): string {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token returned. Revoke prior consent at https://myaccount.google.com/permissions and retry.");
  }
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const me = await oauth2.userinfo.get();
  const email = me.data.email ?? "unknown@example.com";
  const sub = me.data.id ?? "unknown";

  db.prepare("DELETE FROM account WHERE id = 1").run();
  db.prepare(
    `INSERT INTO account (id, google_sub, email, refresh_token, access_token, access_token_expires_at, created_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).run(
    sub,
    email,
    tokens.refresh_token,
    tokens.access_token ?? null,
    tokens.expiry_date ?? null,
    Date.now()
  );
  return { email };
}

export function getAccount(): { email: string; refresh_token: string } | null {
  const row = db.prepare("SELECT email, refresh_token FROM account WHERE id = 1").get() as
    | { email: string; refresh_token: string }
    | undefined;
  return row ?? null;
}

export function signOut() {
  db.prepare("DELETE FROM account WHERE id = 1").run();
}

export async function getAuthedClient(): Promise<OAuth2Client> {
  const acct = getAccount();
  if (!acct) throw new Error("Not authenticated");
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: acct.refresh_token });
  return client;
}
