import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getFirebaseMessaging } from './firebase-admin';

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const supabase = adminClient();
    const { data: rows } = await supabase
      .from('push_tokens')
      .select('id, token')
      .eq('user_id', userId);

    if (!rows?.length) return;

    const messaging = getFirebaseMessaging();
    const staleIds: string[] = [];

    await Promise.allSettled(
      rows.map(async (row) => {
        try {
          await messaging.send({
            token: row.token,
            notification: { title, body },
            data: data ?? {},
            apns: {
              payload: { aps: { badge: 1, sound: 'default' } },
            },
            android: {
              priority: 'high',
              notification: { sound: 'default' },
            },
          });
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code ?? '';
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            staleIds.push(row.id);
          }
        }
      })
    );

    if (staleIds.length > 0) {
      await supabase.from('push_tokens').delete().in('id', staleIds);
    }
  } catch {
    // Push is non-fatal — never let it break the calling API route
  }
}
