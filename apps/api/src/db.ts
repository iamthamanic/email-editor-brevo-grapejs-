/**
 * Prisma client singleton for the API process.
 * Location: apps/api/src/db.ts
 */

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
