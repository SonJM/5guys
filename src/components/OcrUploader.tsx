'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Toast } from './Toast'
import type { ToastState } from './Toast'
import type { WorkPattern } from '@/types'
import Link from 'next/link'

type ParsedSchedule = {
  date: string
  status: string
}

export default function OcrUploader() {
  const [ocrResult, setOcrResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [parsedSchedules, setParsedSchedules] = useState<ParsedSchedule[]>([])
  const [targetYear, setTargetYear] = useState(new Date().getFullYear())
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1)
  const [workPatterns, setWorkPatterns] = useState<WorkPattern[]>([])
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    const loadWorkPatterns = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('work_patterns')
        .select('*')
        .eq('user_id', user.id)
      if (data) setWorkPatterns(data as WorkPattern[])
    }
    loadWorkPatterns()
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setOcrResult('')
    setParsedSchedules([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (!response.ok) throw new Error('이미지 처리에 실패했습니다.')

      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setOcrResult(data.ocrResult)
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!ocrResult) return
    setIsAnalyzing(true)
    setParsedSchedules([])

    try {
      const workPatternMap = workPatterns.map(p => ({
        label: p.shift_name,
        code: p.shift_code,
        startTime: p.start_time,
        endTime: p.end_time,
      }))

      const response = await fetch('/api/ocr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrText: ocrResult, workPatternMap, year: targetYear, month: targetMonth }),
      })

      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || '분석에 실패했습니다.')

      setParsedSchedules(data.schedules)
      if (data.schedules.length === 0) {
        setToast({ message: '일정을 추출하지 못했습니다. OCR 텍스트를 확인해주세요.', type: 'info' })
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveSchedules = async () => {
    if (parsedSchedules.length === 0) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setToast({ message: '로그인이 필요합니다.', type: 'error' })
      return
    }

    const schedulesToSave = parsedSchedules.map(s => ({
      user_id: user.id,
      date: s.date,
      status: s.status,
    }))

    const { error } = await supabase.from('schedules').upsert(schedulesToSave)

    if (error) {
      setToast({ message: '저장에 실패했습니다: ' + error.message, type: 'error' })
    } else {
      setToast({ message: `${schedulesToSave.length}개의 스케줄이 저장되었습니다.`, type: 'success' })
      setOcrResult('')
      setParsedSchedules([])
    }
  }

  return (
    <div className="mt-4">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">캘린더 사진으로 일정 등록</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        사용하시는 캘린더 앱의 스크린샷을 업로드하여 일정을 인식할 수 있습니다.
      </p>

      {workPatterns.length === 0 && (
        <div className="mt-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          근무 패턴이 등록되지 않아 OCR 정확도가 낮을 수 있습니다.{' '}
          <Link href="/settings/work-pattern" className="underline font-semibold">
            패턴 등록하기 →
          </Link>
        </div>
      )}

      <div className="mt-4">
        <label
          htmlFor="ocr-upload"
          className="cursor-pointer px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-400"
        >
          이미지 파일 선택
        </label>
        <input
          id="ocr-upload"
          type="file"
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
          disabled={isLoading}
        />
      </div>

      {isLoading && (
        <div className="mt-4">
          <p className="font-semibold text-blue-600 dark:text-blue-400">이미지를 인식하고 있습니다...</p>
        </div>
      )}

      {ocrResult && (
        <div className="mt-4">
          <h4 className="font-semibold dark:text-slate-100">1단계: 인식된 텍스트 결과</h4>
          <pre className="mt-2 p-4 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md text-sm whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
            {ocrResult}
          </pre>

          <div className="mt-4">
            <h4 className="font-semibold dark:text-slate-100">2단계: 스케줄 분석</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">연도와 월을 확인하고 AI 분석을 시작하세요.</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <select
                value={targetYear}
                onChange={e => setTargetYear(Number(e.target.value))}
                className="p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
              >
                <option>{new Date().getFullYear() - 1}</option>
                <option>{new Date().getFullYear()}</option>
                <option>{new Date().getFullYear() + 1}</option>
              </select>
              <select
                value={targetMonth}
                onChange={e => setTargetMonth(Number(e.target.value))}
                className="p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-slate-400"
              >
                {isAnalyzing ? 'AI 분석 중...' : 'AI 분석'}
              </button>
            </div>

            {parsedSchedules.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold dark:text-slate-100">분석 결과 ({parsedSchedules.length}개):</h5>
                <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1 text-sm text-slate-700 dark:text-slate-300 max-h-48 overflow-y-auto">
                  {parsedSchedules.map(s => (
                    <li key={s.date} className="flex items-center gap-1">
                      <span className="text-slate-500">{s.date}</span>
                      <span className="font-semibold">{s.status}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleSaveSchedules}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700"
                >
                  이 스케줄 저장하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
