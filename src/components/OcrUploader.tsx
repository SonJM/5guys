'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

// 분석된 스케줄의 타입을 정의합니다.
type ParsedSchedule = {
  date: string;
  status: string;
}

export default function OcrUploader() {
  const [ocrResult, setOcrResult] = useState('')
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

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to process image')
      }

      const data = await response.json()
      setOcrResult(data.ocrResult)
    } catch (error) {
      console.error(error)
      alert('이미지 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // --- Shiftee 캘린더에 최적화된 새로운 분석 로직 ---
  const handleParseText = () => {
    const lines = ocrResult.split(/\n|\s{2,}/).filter(line => line.trim() !== '');
    const schedules: ParsedSchedule[] = [];
    const year = targetYear;
    const month = targetMonth;

    let dateLineIndex = -1;

    // "DATE" 또는 "일"을 포함하는 줄을 찾아 날짜 줄로 설정
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('DATE') || lines[i].includes('일')) {
            dateLineIndex = i;
            break;
        }
    }

    if (dateLineIndex !== -1) {
        const dateLine = lines[dateLineIndex].replace(/DATE|일|월|화|수|목|금|토/g, '').trim();
        const dates = dateLine.split(/\s+/).filter(d => d && !isNaN(parseInt(d, 10)));

        for (let i = dateLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('조')) {
                const statuses = line.replace(/[가-힣]|조/g, '').trim().split(/\s+/).filter(s => s);
                for (let j = 0; j < Math.min(dates.length, statuses.length); j++) {
                    const day = parseInt(dates[j], 10);
                    if (day > 0 && day <= 31) {
                        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const status = statuses[j].replace(/[^A-Z]/g, '');
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
          <p className="font-semibold text-blue-600 dark:text-blue-400">
            이미지를 분석하고 있습니다...
          </p>
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