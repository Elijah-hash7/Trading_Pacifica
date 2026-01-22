import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma : PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

try {
    prismaInstance = globalForPrisma.prisma ?? new PrismaClient();
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize PrismaClient:', message);
    prismaInstance = null as unknown as PrismaClient;
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}