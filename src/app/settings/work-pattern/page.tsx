import Link from "next/link";
import WorkPatternEditor from "@/components/WorkPatternEditor";

export default function WorkPatternPage() {
  return <main className="app-shell min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl space-y-6">
    <Link href="/dashboard" className="brand-link text-sm">← 대시보드로 돌아가기</Link>
    <div><p className="eyebrow">WORK PATTERNS</p><h1 className="mt-2 text-3xl font-black tracking-tight">나의 근무 표기와 시간</h1></div>
    <WorkPatternEditor />
  </div></main>;
}
