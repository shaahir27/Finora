import NextAuth, { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase-client";
import { DEMO_SCHOOL_ID } from "@/lib/school-context";

const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      id: "admin-login",
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        // Demo hardcoded admin logic
        if (
          credentials.email === "admin@school.edu" &&
          credentials.password === "demo1234"
        ) {
          return {
            id: "seed-admin-01",
            email: credentials.email as string,
            role: "admin",
            schoolId: DEMO_SCHOOL_ID,
          } as any;
        }
        return null;
      },
    }),
    CredentialsProvider({
      id: "parent-otp",
      name: "Parent OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        email: { label: "Email", type: "text" },
        otp: { label: "OTP", type: "text" },
        type: { label: "Type", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.otp || !credentials?.type) return null;

        // DEMO BYPASS
        if (
          (credentials.email === "parent@demo.com" || credentials.phone === "+919999999999") &&
          credentials.otp === "123456"
        ) {
          return {
            id: "demo-parent-id",
            email: "parent@demo.com",
            role: "parent",
            schoolId: DEMO_SCHOOL_ID,
            parentLinkId: "parent-link-demo-id",
          } as any;
        }

        const { data, error } = await supabase.auth.verifyOtp({
          ...(credentials.phone ? { phone: credentials.phone as string } : {}),
          ...(credentials.email ? { email: credentials.email as string } : {}),
          token: credentials.otp as string,
          type: credentials.type as "sms" | "email",
        } as any);

        if (error || !data.user) {
          return null;
        }

        return {
          id: data.user.id,
          email: data.user.email ?? null,
          role: "parent",
          schoolId: DEMO_SCHOOL_ID,
          parentLinkId: data.user.id,
        } as any;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.schoolId = user.schoolId;
        token.parentLinkId = user.parentLinkId;
      }
      return token;
    },
    session({ session, token }: any) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        (session.user as any).schoolId = token.schoolId as string;
        (session.user as any).parentLinkId = token.parentLinkId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: { strategy: "jwt" },
};

const _nextAuth = NextAuth(authConfig);

export const handlers = _nextAuth.handlers as any;
export const auth = _nextAuth.auth as any;
export const signIn = _nextAuth.signIn as any;
export const signOut = _nextAuth.signOut as any;
