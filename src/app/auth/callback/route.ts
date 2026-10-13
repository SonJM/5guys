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
      const calendarFailure = (message: string) => {
        const url = new URL(next, origin)
        url.searchParams.set('calendarError', message)
        return NextResponse.redirect(url)
      }
      // Calendar setup must never undo a completed app login.
      try {
      const identity = data.user?.identities?.find((item) => item.provider === 'google')
      const googleAccount = identity?.identity_data?.sub ?? identity?.id
      if (!googleAccount || !data.user) return calendarFailure('로그인은 완료됐지만 Google Calendar 계정을 확인하지 못했습니다. 연결 복구를 이용해주세요.')
      const db = adminDb()
      const { data: existing, error: lookupError } = await db.from('google_connections')
        .select('google_account,refresh_token').eq('user_id', data.user.id).maybeSingle()
      if (lookupError || (existing && existing.google_account !== googleAccount)) {
        return calendarFailure('Google 계정 연결을 확인해주세요.')
      }
      if (data.session?.provider_refresh_token || existing?.refresh_token) {
        const { error: saveError } = await db.from('google_connections').upsert({
          user_id: data.user.id,
          google_account: googleAccount,
          calendar_id: 'primary',
          refresh_token: data.session?.provider_refresh_token
            ? seal(data.session.provider_refresh_token) : existing!.refresh_token,
          ...(data.session?.provider_refresh_token ? { last_error: null } : {}),
        })
        if (saveError) return calendarFailure('로그인은 완료됐지만 Google Calendar 연결을 저장하지 못했습니다. 연결 복구를 이용해주세요.')
      } else {
        return calendarFailure('로그인은 완료됐습니다. Calendar 권한은 연결 복구에서 승인해주세요.')
      }
      } catch {
        return calendarFailure('로그인은 완료됐지만 Calendar 연결 처리에 실패했습니다. 연결 복구를 이용해주세요.')
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
