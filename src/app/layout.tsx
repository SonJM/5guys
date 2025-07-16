import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider' // ThemeProvider 임포트

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '5총사',
  description: '우리의 여행을 위한 스케줄 조율기',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50`}>
        {/* ThemeProvider로 감싸고, 시스템 테마를 따르도록 설정 */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}