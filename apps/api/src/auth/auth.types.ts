export type AuthenticatedUserRole = "ADMIN" | "USER";
export type AuthenticatedUserPlan = "FREE" | "CORE" | "PRO";

export interface AuthenticatedUser {
  id: string;
  authProviderId?: string;
  email: string;
  firstName?: string;
  role: AuthenticatedUserRole;
  plan: AuthenticatedUserPlan;
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
