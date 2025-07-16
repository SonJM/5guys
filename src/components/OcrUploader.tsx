'use client'

import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { createClient } from '@/utils/supabase/client'

// 분석된 스케줄의 타입을 정의합니다.
type ParsedSchedule = {
  date: string;
  status: string;
}

export default function OcrUploader() {
  const [ocrResult, setOcrResult] = useState('')
  const [progress, setProgress] = useState({ status: '대기 중', percentage: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [parsedSchedules, setParsedSchedules] = useState<ParsedSchedule[]>([])
  const [targetYear, setTargetYear] = useState(new Date().getFullYear())
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setOcrResult('')
    setParsedSchedules([])
    setProgress({ status: '워커 준비 중', percentage: 0 })

    try {
      const worker = await createWorker('kor+eng', undefined, {
        logger: m => {
          setProgress({ status: m.status, percentage: m.progress * 100 })
        }
      });
      const { data: { text } } = await worker.recognize(file)
      setOcrResult(text)
      setProgress({ status: '완료', percentage: 100 })
      await worker.terminate()
    } catch (error) {
      console.error(error)
      setProgress({ status: '에러 발생', percentage: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  // --- Shiftee 캘린더에 최적화된 새로운 분석 로직 ---
  const handleParseText = () => {
    const lines = ocrResult.split('\n');
    const schedules: ParsedSchedule[] = [];
    
    // 1. 연도와 월 자동 감지 시도
    const yearMatch = ocrResult.match(/(\d{4})년/);
    const monthMatch = ocrResult.match(/(\d{1,2})월/);
    const currentYear = yearMatch ? parseInt(yearMatch[1], 10) : targetYear;
    const currentMonth = monthMatch ? parseInt(monthMatch[1], 10) : targetMonth;

    // 2. 한 줄씩 순회하며 날짜와 근무를 매칭
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();

      // 현재 줄이 주로 숫자로 이루어져 있는지 확인 (날짜 줄 후보)
      if (/^[\d\s]+$/.test(currentLine) && (currentLine.match(/\d/g)?.length ?? 0) > 2) {
        
        // 다음 줄이 주로 대문자로 이루어져 있는지 확인 (근무 형태 줄 후보)
        if (/^([A-Z]\s*)+$/.test(nextLine.replace(/\|/g, ''))) {
          const days = currentLine.split(/\s+/).filter(d => d); // 숫자들
          const statuses = nextLine.split(/\s+/).filter(s => s); // 근무 형태들

          // 날짜와 근무 형태를 1:1로 매칭
          for (let j = 0; j < Math.min(days.length, statuses.length); j++) {
            const day = parseInt(days[j], 10);
            const status = statuses[j].replace(/[^A-Z]/g, ''); // 특수문자 제거

            if (day > 0 && day <= 31 && status) {
              const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              // status를 '근무' 또는 다른 값으로 변환 (필요 시 수정)
              const workStatus = (status === 'A' || status === 'B' || status === 'C' || status === 'D') ? '근무' : '휴무';
              schedules.push({ date, status: workStatus });
            }
          }
        }
      }
    }
    setParsedSchedules(schedules);
  };
  
  const handleSaveSchedules = async () => {
    if (parsedSchedules.length === 0) return;
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    const schedulesToSave = parsedSchedules.map(s => ({
      user_id: user.id,
      date: s.date,
      status: s.status
    }));

    const { error } = await supabase.from('schedules').upsert(schedulesToSave);

    if (error) {
      alert('저장에 실패했습니다: ' + error.message);
    } else {
      alert(`${schedulesToSave.length}개의 스케줄이 성공적으로 저장되었습니다. 페이지를 새로고침하여 달력에 반영하세요.`);
      setOcrResult('');
      setParsedSchedules([]);
    }
  }

  return (
    <div className="mt-12 p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">🤖 캘린더 사진으로 일정 등록 (Beta)</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        사용하시는 캘린더 앱의 스크린샷을 업로드하여 일정을 인식할 수 있습니다.
      </p>

      {/* --- 이 부분이 빠져있었습니다 --- */}
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
          <p className="font-semibold text-blue-600 dark:text-blue-400 capitalize">
            {progress.status}... ({Math.round(progress.percentage)}%)
          </p>
          <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700 mt-1">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {ocrResult && (
        <div className="mt-4">
          <h4 className="font-semibold dark:text-slate-100">🔍 1단계: 인식된 텍스트 결과</h4>
          <pre className="mt-2 p-4 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-md text-sm whitespace-pre-wrap font-sans">
            {ocrResult}
          </pre>
          
          <div className="mt-6">
            <h4 className="font-semibold dark:text-slate-100">⚙️ 2단계: 스케줄 분석 및 저장</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">인식된 스케줄의 연도와 월을 확인하고 분석 버튼을 누르세요.</p>
            <div className="flex items-center gap-4 mt-2">
              <select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} className="p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                <option>{new Date().getFullYear() -1}</option>
                <option>{new Date().getFullYear()}</option>
                <option>{new Date().getFullYear() + 1}</option>
              </select>
              <select value={targetMonth} onChange={e => setTargetMonth(Number(e.target.value))} className="p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <button onClick={handleParseText} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">텍스트 분석</button>
            </div>
            
            {parsedSchedules.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold dark:text-slate-100">📊 분석 결과 ({parsedSchedules.length}개):</h5>
                <ul className="mt-2 list-disc list-inside text-sm text-slate-700 dark:text-slate-300">
                  {parsedSchedules.map(s => (
                    <li key={s.date}>{s.date}: {s.status}</li>
                  ))}
                </ul>
                <button onClick={handleSaveSchedules} className="mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700">
                  이 스케줄 저장하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}