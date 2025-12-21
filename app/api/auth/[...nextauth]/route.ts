import NextAuth from 'next-auth';
import authOptions from '../../../../auth';

function createHandler() {
  // Initialize NextAuth handler per invocation to avoid module-initialization issues
  try {
    const handler = NextAuth(authOptions as any);
    console.log('NextAuth handler initialized. type=', typeof handler, 'isObject=', !!(handler && typeof handler === 'object'), 'keys=', handler && typeof handler === 'object' ? Object.keys(handler) : undefined);
    if (handler && (handler as any).handlers) {
      try {
        console.log('NextAuth internal handlers keys=', Object.keys((handler as any).handlers));
      } catch (e) {
        console.log('Failed to enumerate internal handlers', e);
      }
    }

    // NextAuth v4 returns a function handler(req) => Response
    if (typeof handler === 'function') return handler;

    // NextAuth v5 (beta) may return an object with verb handlers under `handlers` property
    if (handler && typeof handler === 'object') {
      return async (req: Request) => {
        const method = (req.method || 'GET').toUpperCase();

        // Try multiple candidate keys (upper/lowercase), internal handlers, and common fallbacks
        const candidates = [method, method.toLowerCase(), 'handler', 'default'];
        let fn: Function | undefined;

        for (const key of candidates) {
          const candidate = (handler as any)[key];
          if (typeof candidate === 'function') {
            fn = candidate;
            break;
          }
        }

        if (!fn && (handler as any).handlers) {
          for (const key of [method, method.toLowerCase()]) {
            const candidate = (handler as any).handlers[key];
            if (typeof candidate === 'function') {
              fn = candidate;
              break;
            }
          }
        }

        // If nothing found but handler itself is callable, use it
        if (!fn && typeof handler === 'function') fn = handler as any;

        if (typeof fn === 'function') return await (fn as any)(req);
        return new Response('Method Not Allowed', { status: 405 });
      };
    }

    return (_req: Request) => new Response('Auth initialization error: unexpected handler type', { status: 500 });
  } catch (err) {
    console.error('NextAuth initialization failed:', err);
    return (_req: Request) => new Response('Auth initialization error', { status: 500 });
  }
}

const handler = createHandler();

export const GET = (req: Request) => handler(req);
export const POST = (req: Request) => handler(req);
export const PUT = (req: Request) => handler(req);
export const DELETE = (req: Request) => handler(req);
export const OPTIONS = (req: Request) => handler(req);
export const HEAD = (req: Request) => handler(req);

export const dynamic = 'force-dynamic';
