import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  if (!code) return new Response('Missing code', { status: 400 });
  if (!userId) return new Response('Missing state (user ID)', { status: 400 });

  const redirectUri = `${requestUrl.origin}/api/github/callback`;

  // exchange code for access token
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
      client_secret:
        process.env.GITHUB_CLIENT_SECRET ??
        process.env.NEXT_PUBLIC_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();

  const token = data.access_token;

  if (!token) {
    return new Response(data.error_description ?? data.error ?? 'OAuth failed', {
      status: 400,
    });
  }

  // create supabase client with service role
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // save the GitHub token to the user's metadata
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      github_token: token,
    },
  });

  if (error) {
    return new Response(error.message, { status: 400 });
  }

  // redirect back to settings
  return Response.redirect(`${requestUrl.origin}/dashboard/settings`);
}
