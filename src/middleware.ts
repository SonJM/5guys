import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete(name)
        },
      },
    }
  )

  // 미들웨어의 가장 중요한 역할: 사용자의 세션 정보를 최신 상태로 유지합니다.
  const { data: { user } } = await supabase.auth.getUser()

  // 사용자가 로그인하지 않았고, 접근하려는 경로가 보호된 경로일 경우 로그인 페이지로 리디렉션합니다.
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 아래 경로들에 대해서만 미들웨어를 실행합니다.
     * - api (API routes)
     * - dashboard (보호된 경로)
     * - account (보호된 경로)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}