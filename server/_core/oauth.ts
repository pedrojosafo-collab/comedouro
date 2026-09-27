import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

console.log("[ENV CHECK]", {
  GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI,
  JWT_SECRET: !!process.env.JWT_SECRET,
});
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/login", (_req: Request, res: Response) => {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI
    ) {
      res.status(500).json({
        error:
          "Google OAuth não configurado. Verifique GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.",
      });
      return;
    }

    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
    });

    res.redirect(authUrl);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");

    if (!code) {
      res.status(400).json({
        error: "Código de autorização do Google não encontrado.",
      });
      return;
    }

    try {
      const { tokens } = await googleClient.getToken(code);

      if (!tokens.id_token) {
        throw new Error("Google não retornou o ID token.");
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub) {
        throw new Error("Não foi possível identificar a conta Google.");
      }

      const openId = `google:${payload.sub}`;
      const name = payload.name ?? payload.email ?? "Usuário";
      const email = payload.email ?? null;

      await db.upsertUser({
        openId,
        name,
        email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      if (!ENVReady()) {
        throw new Error("JWT_SECRET não configurado.");
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });

      console.log(`[Google OAuth] Login realizado: ${email ?? openId}`);
      res.redirect("/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed:", error);
      res.status(500).json({
        error: "Não foi possível concluir o login com Google.",
      });
    }
  });
}

function ENVReady() {
  return Boolean(process.env.JWT_SECRET);
}
