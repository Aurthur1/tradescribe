import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createPublicKey, verify } from "node:crypto";
import { AuditLogService } from "../common/audit-log.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthenticatedUser, RequestWithUser } from "./auth.types.js";

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  azp?: string;
  email?: string;
  email_address?: string;
  exp?: number;
  first_name?: string;
  given_name?: string;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
};

type ClerkUserResponse = {
  email_addresses?: Array<{ email_address?: string; id?: string }>;
  first_name?: string | null;
  primary_email_address_id?: string | null;
};

type UserRow = {
  authProviderId: string;
  email: string;
  firstName: string | null;
  id: string;
  plan: "FREE" | "CORE" | "PRO";
  role: "ADMIN" | "USER";
  status: string;
};

const jwksCache = new Map<string, { expiresAt: number; keys: Array<Record<string, unknown>> }>();

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function base64UrlDecode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function parseJwt(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) throw new UnauthorizedException("Invalid session token");
  return {
    encodedHeader,
    encodedPayload,
    header: JSON.parse(base64UrlDecode(encodedHeader)) as JwtHeader,
    payload: JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload,
    signature
  };
}

function extractCookie(cookieHeader: string | undefined, key: string) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${key}=`));
  return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

function extractBearerToken(request: RequestWithUser) {
  const authorization = headerValue(request.headers.authorization);
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return extractCookie(headerValue(request.headers.cookie), "__session");
}

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function fetchJwks(issuer: string) {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/jwks.json`);
  if (!response.ok) throw new UnauthorizedException("Could not verify session token");
  const payload = (await response.json()) as { keys?: Array<Record<string, unknown>> };
  const keys = payload.keys ?? [];
  jwksCache.set(issuer, { expiresAt: Date.now() + 10 * 60_000, keys });
  return keys;
}

async function verifyClerkToken(token: string) {
  const parsed = parseJwt(token);
  if (!parsed.payload.sub || !parsed.payload.iss || !parsed.header.kid || parsed.header.alg !== "RS256") {
    throw new UnauthorizedException("Invalid session token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.payload.exp && parsed.payload.exp < now) throw new UnauthorizedException("Session expired");
  if (parsed.payload.nbf && parsed.payload.nbf > now) throw new UnauthorizedException("Session not active");

  const keys = await fetchJwks(parsed.payload.iss);
  const jwk = keys.find((key) => key.kid === parsed.header.kid);
  if (!jwk) throw new UnauthorizedException("Could not verify session token");

  const publicKey = createPublicKey({ format: "jwk", key: jwk });
  const valid = verify(
    "RSA-SHA256",
    Buffer.from(`${parsed.encodedHeader}.${parsed.encodedPayload}`),
    publicKey,
    Buffer.from(parsed.signature.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  );

  if (!valid) throw new UnauthorizedException("Invalid session token");
  return parsed.payload;
}

async function fetchClerkUser(authProviderId: string): Promise<ClerkUserResponse | null> {
  const secret = process.env.AUTH_PROVIDER_SECRET;
  if (!secret) return null;
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(authProviderId)}`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  if (!response.ok) return null;
  return (await response.json()) as ClerkUserResponse;
}

function primaryEmail(payload: JwtPayload, clerkUser: ClerkUserResponse | null) {
  const tokenEmail = payload.email ?? payload.email_address;
  if (tokenEmail) return tokenEmail.toLowerCase();
  const primaryId = clerkUser?.primary_email_address_id;
  const primary = clerkUser?.email_addresses?.find((email) => email.id === primaryId)?.email_address;
  return primary?.toLowerCase() ?? clerkUser?.email_addresses?.[0]?.email_address?.toLowerCase() ?? null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      if (process.env.NODE_ENV !== "production" && !process.env.AUTH_PROVIDER_SECRET) {
        request.user = {
          authProviderId: "dev:local",
          email: "trader@example.com",
          firstName: "Trader",
          id: "dev-user",
          plan: (process.env.DEV_USER_PLAN as "FREE" | "CORE" | "PRO") ?? "FREE",
          role: process.env.DEV_USER_ROLE === "ADMIN" ? "ADMIN" : "USER"
        };
        return true;
      }

      throw new UnauthorizedException("Authentication required");
    }

    const payload = await verifyClerkToken(token);
    const clerkUser = await fetchClerkUser(payload.sub!);
    const email = primaryEmail(payload, clerkUser);
    if (!email) throw new UnauthorizedException("Authenticated user has no email");

    const firstName = payload.first_name ?? payload.given_name ?? clerkUser?.first_name ?? null;
    const prisma = await this.prismaService.client();
    const existing = (await prisma.user.findFirst({
      where: { OR: [{ authProviderId: payload.sub }, { email }] }
    })) as UserRow | null;

    const allowedAdmin = adminEmails().has(email);
    const role = allowedAdmin ? "ADMIN" : "USER";
    let user: UserRow;

    if (existing) {
      const shouldBootstrapRole = existing.authProviderId.startsWith("legacy:");
      user = (await prisma.user.update({
        where: { id: existing.id },
        data: {
          authProviderId: shouldBootstrapRole ? payload.sub : existing.authProviderId,
          email,
          ...(firstName ? { firstName } : {}),
          ...(shouldBootstrapRole ? { role } : {})
        }
      })) as UserRow;
      if (shouldBootstrapRole) {
        await this.auditLog.record({
          action: "role.bootstrap",
          actorUserId: user.id,
          metadata: { allowedAdmin, role },
          targetUserId: user.id
        });
      }
    } else {
      user = (await prisma.user.create({
        data: {
          authProviderId: payload.sub,
          email,
          firstName,
          role,
          preferences: { create: {} }
        }
      })) as UserRow;

      await this.auditLog.record({
        action: "role.bootstrap",
        actorUserId: user.id,
        metadata: { allowedAdmin, role },
        targetUserId: user.id
      });
    }

    if (user.status === "suspended") {
      throw new ForbiddenException("Account suspended");
    }

    await this.auditLog.record({
      action: "login",
      actorUserId: user.id,
      ip: headerValue(request.headers["x-forwarded-for"]) ?? undefined,
      metadata: { authProvider: "clerk" },
      targetUserId: user.id
    });

    request.user = {
      authProviderId: user.authProviderId,
      email: user.email,
      firstName: user.firstName ?? undefined,
      id: user.id,
      plan: user.plan,
      role: user.role
    } satisfies AuthenticatedUser;

    return true;
  }
}
