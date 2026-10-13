// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
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
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const redirect = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie))
    return redirected
  }

  // 보호된 경로: 로그인하지 않은 사용자는 로그인 페이지로 리디렉션
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/account') || pathname.startsWith('/settings'))) {
    return redirect('/login')
  }

  // 공개 경로: 로그인한 사용자가 접근 시 대시보드로 리디렉션
  if (user && (pathname === '/login' || pathname === '/')) {
    return redirect('/dashboard')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - auth/callback (Supabase auth callback)
     * - icon.svg and favicon.ico (brand icons)
     */
    '/((?!api|_next/static|_next/image|auth/callback|icon.svg|favicon.ico).*)',
  ],
}
