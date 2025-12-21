import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { users as placeholderUsers } from '@/app/lib/placeholder-data';
 
// Lazily initialize SQL client only if POSTGRES_URL is provided and reachable
let sql: ReturnType<typeof postgres> | undefined;
if (process.env.POSTGRES_URL) {
  try {
    sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });
  } catch (err) {
    console.warn('Could not initialize Postgres client, falling back to placeholder users:', err);
    sql = undefined;
  }
}
 
async function getUser(email: string): Promise<User | undefined> {
  if (sql) {
    try {
      const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
      const dbUser = user?.[0];
      console.log('getUser: queried DB for email=', email, 'found=', !!dbUser);
      if (dbUser) return dbUser;
      console.log('getUser: DB returned no user, falling back to placeholder lookup for email=', email);
    } catch (error) {
      console.error('Failed to fetch user from database, falling back to placeholder:', error);
      // don't throw; fall back to placeholder below
    }
  }

  // Fallback to placeholder users (useful for local development without DB)
  const found = placeholderUsers.find((u) => u.email === email);
  console.log('getUser: used placeholder lookup for email=', email, 'found=', !!found);
  return found;
}
 
export const authOptions = {
  ...authConfig,
  providers: [
    Credentials({
      // Explicitly declare the expected credential fields to avoid confusion
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      } as any,
      authorize: async (credentials: any) => {
        console.log('Credentials provider authorize called with:', credentials);
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          console.log('Credentials validation failed:', parsedCredentials.error?.format());
          return null;
        }

        const { email, password } = parsedCredentials.data;
        try {
          const user = await getUser(email);
          console.log('Found user for authorize:', !!user, user ? { email: user.email, id: user.id } : undefined);
          if (!user) return null;

          // If the stored password looks like a bcrypt hash (starts with $2), use bcrypt.compare
          const isBcrypt = typeof user.password === 'string' && user.password.startsWith('$2');
          let passwordsMatch = false;
          if (isBcrypt) {
            passwordsMatch = await bcrypt.compare(password, user.password);
          } else {
            passwordsMatch = password === user.password;
          }

          console.log('Password match result for', email, passwordsMatch);

          if (passwordsMatch) {
            // Sanitize user object returned to NextAuth (do not include password)
            const safeUser = { id: user.id, name: user.name, email: user.email } as unknown as User;
            return safeUser;
          }
          return null;
        } catch (err) {
          console.error('Authorize error:', err);
          return null;
        }
      },
    }),
  ],
};

// Do not initialize NextAuth here; route handler will call `NextAuth(authOptions)`
// Export authOptions for the app router route handler to use.
export default authOptions;