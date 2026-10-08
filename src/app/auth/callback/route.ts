import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminDb } from '@/lib/server'
import { seal } from '@/lib/google'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requested = searchParams.get('next') ?? '/dashboard'
  const next = requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\') ? requested : '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const identity = data.user?.identities?.find((item) => item.provider === 'google')
      const googleAccount = identity?.id
      if (!googleAccount || !data.user) return NextResponse.redirect(`${origin}/login?error=auth`)
      const db = adminDb()
      const { data: existing, error: lookupError } = await db.from('google_connections')
        .select('google_account,refresh_token').eq('user_id', data.user.id).maybeSingle()
      if (lookupError || (existing && existing.google_account !== googleAccount)) {
        return NextResponse.redirect(`${origin}/dashboard?calendarError=Google%20계정%20연결을%20확인해주세요`)
      }
      if (data.session?.provider_refresh_token || existing?.refresh_token) {
        const { error: saveError } = await db.from('google_connections').upsert({
          user_id: data.user.id,
          google_account: googleAccount,
          calendar_id: 'primary',
          refresh_token: data.session?.provider_refresh_token
            ? seal(data.session.provider_refresh_token) : existing!.refresh_token,
          last_error: null,
        })
        if (saveError) return NextResponse.redirect(`${origin}/dashboard?calendarError=Google%20Calendar%20연결을%20저장하지%20못했습니다`)
      } else {
        return NextResponse.redirect(`${origin}/dashboard?calendarError=Calendar%20권한을%20다시%20승인해주세요`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
