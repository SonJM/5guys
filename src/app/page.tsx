import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 text-center p-4">
      <h1 className="text-4xl md:text-6xl font-bold text-slate-800 dark:text-slate-100">
        🗓️ 5총사
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        친구들과의 약속, 최소한의 휴가로 잡으세요!
      </p>
      <div className="mt-8 flex gap-4">
        <Link 
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700"
        >
          로그인 / 회원가입
        </Link>
        <a 
          href="https://github.com/SonJM"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-slate-200 text-slate-800 font-bold rounded-lg shadow-md hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          GitHub
        </a>
      </div>
    </div>
  )
}