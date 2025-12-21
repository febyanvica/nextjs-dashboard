import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret',
  trustHost: true,
  callbacks: {
    signIn({ user, account, profile }) {
      // Log sign-in attempts to help debug CredentialsSignin issues during development
      try {
        console.log('NextAuth signIn callback - user:', { id: user?.id, email: user?.email }, 'account:', account?.provider, 'profileKeys:', profile ? Object.keys(profile) : undefined);
      } catch (e) {
        console.log('NextAuth signIn callback logging failed', e);
      }
      // Allow sign-in by default (return true) — adjust for production policies
      return true;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      // Allow access to the dashboard only when authenticated.
      // Otherwise, allow access to other pages (including /login).
      if (isOnDashboard) return isLoggedIn;
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;