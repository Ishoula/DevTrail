import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) return new Response('Missing code', { status: 400 });

  // exchange code
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await res.json();

  const token = data.access_token;

  if (!token) {
    return new Response('OAuth failed', { status: 400 });
  }

  // create supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // OPTIONAL: get user via session cookie instead in production
  await supabase.auth.admin.updateUserById(
    /* user_id (see note below) */ '',
    {
      user_metadata: {
        github_token: token,
      },
    }
  );

  // redirect cleanly
  return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings`);
}