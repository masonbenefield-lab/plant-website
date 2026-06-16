import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Register a device push token for the authenticated user
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, platform } = await req.json() as { token?: string; platform?: string };
  if (!token || !platform) return NextResponse.json({ error: 'Missing token or platform' }, { status: 400 });
  if (platform !== 'ios' && platform !== 'android') {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const admin = adminClient();
  await admin.from('push_tokens').upsert(
    { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
    { onConflict: 'token' }
  );

  return NextResponse.json({ ok: true });
}

// Remove a device push token (on logout or permission revoke)
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json() as { token?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const admin = adminClient();
  await admin.from('push_tokens').delete().eq('token', token).eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
