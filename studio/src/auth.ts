import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { firestoreRestClient } from "@/lib/firestore-rest";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
    async signIn({ user }) {
      if (!user.email) return false;

      const email = user.email;

      // Look up user by raw email as document ID
      // Legacy fallback: also check old-style encoded ID for backward compatibility
      const doc = await firestoreRestClient.getDocument<{
        email?: string;
        name?: string;
        role?: string;
        status?: string;
      }>('admin_users', email);

      const legacyDocId = email.replace(/\./g, '_').replace(/@/g, '_at_');
      const legacyDoc = !doc ? await firestoreRestClient.getDocument<{
        email?: string;
        name?: string;
        role?: string;
        status?: string;
      }>('admin_users', legacyDocId) : null;

      const userDoc = doc || legacyDoc;

      if (!userDoc) {
        // Auto-register as pending — user needs admin approval
        const created = await firestoreRestClient.createDocument('admin_users', email, {
          email,
          name: user.name || '',
          role: 'viewer',
          status: 'pending',
          registered_at: Date.now(),
        });

        if (!created) {
          console.error(`Failed to auto-register ${email}`);
          return false;
        }

        // Redirect to a page showing "awaiting approval" message
        console.warn(`Auto-registered: ${email} — awaiting admin approval`);
        // Return false to prevent sign-in; user sees the sign-in page again
        // We use a custom error URL to show a helpful message
        return `/sign-in?error=AccessPending`;
      }

      const status = userDoc.status || 'approved'; // Legacy docs without status field treated as approved
      const role = userDoc.role || 'viewer';

      if (status === 'pending') {
        return `/sign-in?error=AccessPending`;
      }

      if (status === 'rejected') {
        return `/sign-in?error=AccessDenied`;
      }

      if (status === 'suspended') {
        return `/sign-in?error=AccessSuspended`;
      }

      // If this was a legacy doc, migrate it to the new email-based ID
      if (!doc && legacyDoc) {
        await firestoreRestClient.createDocument('admin_users', email, {
          email: legacyDoc.email || email,
          name: legacyDoc.name || user.name || '',
          role: legacyDoc.role || 'viewer',
          status: 'approved',
        });
        // Note: old doc remains but won't be hit again since we check new ID first
      }

      return true;
    },
    async jwt({ token, user }) {
      // On sign-in, attach role to the JWT token
      if (user?.email) {
        const doc = await firestoreRestClient.getDocument<{
          role?: string;
          status?: string;
        }>('admin_users', user.email);
        token.role = doc?.role || 'viewer';
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role on the client-side session object
      if (session.user && token.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
