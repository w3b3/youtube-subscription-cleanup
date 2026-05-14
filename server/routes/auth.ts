import { Router } from "express";
import { buildAuthUrl, exchangeCode, getAccount, signOut } from "../oauth.js";

export const authRouter = Router();

authRouter.get("/status", (_req, res) => {
  const acct = getAccount();
  res.json({ authenticated: !!acct, email: acct?.email });
});

authRouter.get("/start", (_req, res) => {
  res.redirect(buildAuthUrl());
});

authRouter.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).send("Missing code");
    return;
  }
  try {
    await exchangeCode(code);
    res.redirect("/");
  } catch (err: any) {
    res.status(500).send(`OAuth callback failed: ${err?.message ?? err}`);
  }
});

authRouter.post("/signout", (_req, res) => {
  signOut();
  res.json({ ok: true });
});
