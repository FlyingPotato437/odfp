import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';

export async function GET() {
  let prismaOk = false;
  try {
    // Trivial query to verify connection without touching tables
    await prisma.$queryRawUnsafe('select 1');
    prismaOk = true;
  } catch {
    prismaOk = false;
  }

  const supabaseConfigured = Boolean(supabase);

  return Response.json({ prismaOk, supabaseConfigured }, { status: 200 });
}

