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

      // Check if email exists in the admin_users Firestore collection
      // Document ID is the email address (URL-safe: replace dots and @)
      const docId = user.email.replace(/\./g, '_').replace(/@/g, '_at_');
      const doc = await firestoreRestClient.getDocument('admin_users', docId);

      if (!doc) {
        console.warn(`Sign-in rejected: ${user.email} not in admin_users allow-list`);
        return false;
      }

      return true;
    },
  },
});
