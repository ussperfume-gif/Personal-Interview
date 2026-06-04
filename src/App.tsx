import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Calendar, Users, FileText, Settings, LogIn, LogOut, Plus, Trash2, Check, X, ChevronRight, Printer, Clock, Save } from 'lucide-react';
import { format, addMinutes, parse, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import html2pdf from 'html2pdf.js';

// --- Utils ---
const getTeacherId = () => {
  let id = localStorage.getItem('teacher_id');
  if (!id) {
    id = 't_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('teacher_id', id);
  }
  return id;
};

// --- Types ---
interface ClassInfo {
  id: string;
  name: string;
  teacherId: string;
  schoolName?: string;
  teacherName?: string;
  deadline?: string;
}

interface TimeSlot {
  start: string;
  end: string;
  isAvailable: boolean;
}

interface TeacherAvailability {
  date: string;
  slots: TimeSlot[];
}

interface ParentResponse {
  id: string;
  studentName: string;
  normalizedStudentName?: string;
  guardianPhone?: string;
  talkTopics?: string;
  alternativeSchedule?: string;
  unavailableSlots: { date: string; start: string; end: string }[];
  wantsZoom?: boolean;
  createdAt?: string;
}

interface ScheduleSlot {
  studentName: string;
  date: string;
  start: string;
  end: string;
  type: 'interview' | 'break';
}

interface Schedule {
  slots: ScheduleSlot[];
  settings: {
    breakInterval: number;
    duration: number;
  };
}

// --- Components ---

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isParentView = location.pathname.includes('/parent/');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1C1E] font-sans">
      <header className="bg-white border-b border-[#E1E2E4] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {isParentView ? (
            <div className="flex items-center gap-2 select-none">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Calendar size={20} />
              </div>
              <span className="font-bold text-[#1A1C1E] text-base md:text-lg tracking-tight">面談スケジュール調整（保護者用回答フォーム）</span>
            </div>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Calendar size={20} />
              </div>
              <span className="font-bold text-lg tracking-tight">面談スケジュール調整くん</span>
            </Link>
          )}
          <div className="flex items-center gap-2 text-xs text-[#44474E] bg-[#F0F4F8] px-3 py-1 rounded-full">
            <Save size={12} className="text-green-600" />
            自動保存中
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

const Home = () => {
  return <TeacherDashboard />;
};

const TeacherDashboard = () => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [newClassName, setNewClassName] = useState(() => localStorage.getItem('draft_class_name') || '');
  const [loading, setLoading] = useState(true);
  const teacherId = getTeacherId();

  useEffect(() => {
    localStorage.setItem('draft_class_name', newClassName);
  }, [newClassName]);

  useEffect(() => {
    const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo));
      setClasses(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [teacherId]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await addDoc(collection(db, 'classes'), {
      name: newClassName,
      teacherId: teacherId,
      createdAt: new Date().toISOString()
    });
    setNewClassName('');
    localStorage.removeItem('draft_class_name');
  };

  const handleDeleteClass = async (id: string) => {
    if (window.confirm('このクラスを削除しますか？')) {
      await deleteDoc(doc(db, 'classes', id));
    }
  };

  if (loading) return <div className="flex justify-center py-20">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">担当クラス一覧</h2>
        <form onSubmit={handleCreateClass} className="flex gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="クラス名（例：1年A組）"
            className="px-4 py-2 border border-[#E1E2E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            追加
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        {classes.map((c) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-2xl border border-[#E1E2E4] flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
          >
            <div>
              <h3 className="text-xl font-bold mb-1">{c.name}</h3>
              <p className="text-sm text-[#44474E]">個人面談スケジュール管理</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/teacher/class/${c.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-[#F0F4F8] text-blue-700 rounded-full font-medium hover:bg-blue-100 transition-colors"
              >
                管理画面へ
                <ChevronRight size={16} />
              </Link>
              <button
                onClick={() => handleDeleteClass(c.id)}
                className="p-2 text-[#44474E] hover:text-[#BA1A1A] hover:bg-[#FFDAD6] rounded-full transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        ))}
        {classes.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#E1E2E4]">
            <p className="text-[#44474E]">クラスが登録されていません。右上のボタンから追加してください。</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ClassManagement = () => {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'availability' | 'responses' | 'schedule'>(() => (localStorage.getItem(`active_tab_${classId}`) as any) || 'availability');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({ schoolName: '', teacherName: '', name: '', deadline: '' });

  useEffect(() => {
    if (classId) localStorage.setItem(`active_tab_${classId}`, activeTab);
  }, [activeTab, classId]);

  useEffect(() => {
    if (!classId) return;
    const unsub = onSnapshot(doc(db, 'classes', classId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as ClassInfo;
        setClassInfo(data);
        setEditForm({
          schoolName: data.schoolName || '',
          teacherName: data.teacherName || '',
          name: data.name || '',
          deadline: data.deadline || ''
        });
      }
    });
    return unsub;
  }, [classId]);

  const handleUpdateInfo = async () => {
    if (!classId) return;
    await updateDoc(doc(db, 'classes', classId), editForm);
    setIsEditingInfo(false);
  };

  if (!classInfo) return <div>読み込み中...</div>;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Link to="/" className="text-sm text-blue-600 hover:underline">クラス一覧</Link>
          <span className="text-sm text-[#44474E]">/</span>
          <span className="text-sm font-medium">{classInfo.name}</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-1">{classInfo.name} 管理画面</h2>
            <p className="text-sm text-[#44474E]">
              {classInfo.schoolName || '（学校名未設定）'} ・ {classInfo.teacherName ? `${classInfo.teacherName} 先生` : '（担任名未設定）'}
            </p>
          </div>
          <button
            onClick={() => setIsEditingInfo(!isEditingInfo)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Settings size={16} />
            学校・担任情報を設定
          </button>
        </div>

        <AnimatePresence>
          {isEditingInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 p-6 bg-white rounded-2xl border border-blue-100 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474E] mb-1 uppercase">学校名</label>
                  <input
                    type="text"
                    value={editForm.schoolName}
                    onChange={(e) => setEditForm({ ...editForm, schoolName: e.target.value })}
                    placeholder="例：○○市立○○小学校"
                    className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474E] mb-1 uppercase">担任名</label>
                  <input
                    type="text"
                    value={editForm.teacherName}
                    onChange={(e) => setEditForm({ ...editForm, teacherName: e.target.value })}
                    placeholder="例：山田 太郎"
                    className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474E] mb-1 uppercase">回答締め切り日</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleUpdateInfo}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setIsEditingInfo(false)}
                    className="px-4 py-2 text-[#44474E] hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 mb-8 bg-[#F0F4F8] p-1 rounded-xl w-fit">
        {[
          { id: 'availability', label: '1. 先生の空き時間', icon: Clock },
          { id: 'responses', label: '2. 保護者の回答', icon: Users },
          { id: 'schedule', label: '3. スケジュール作成', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-[#44474E] hover:bg-white/50"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'availability' && <TeacherAvailabilityManager classId={classId!} />}
          {activeTab === 'responses' && <ParentResponseList classId={classId!} />}
          {activeTab === 'schedule' && <ScheduleManager classId={classId!} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const TeacherAvailabilityManager = ({ classId }: { classId: string }) => {
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeRangeType, setTimeRangeType] = useState<'morning' | 'afternoon' | 'full'>('afternoon');

  useEffect(() => {
    const q = collection(db, 'classes', classId, 'teacherAvailability');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as TeacherAvailability);
      setAvailabilities(list.sort((a, b) => a.date.localeCompare(b.date)));
    });
    return unsubscribe;
  }, [classId]);

  const handleAddSlots = async () => {
    const duration = 15;
    const gap = 5;

    const createSlotsInRange = (startStr: string, endStr: string) => {
      const slots: TimeSlot[] = [];
      let current = parse(startStr, 'HH:mm', new Date());
      const end = parse(endStr, 'HH:mm', new Date());

      while (true) {
        const slotEnd = addMinutes(current, duration);
        if (isAfter(slotEnd, end)) break;
        
        slots.push({
          start: format(current, 'HH:mm'),
          end: format(slotEnd, 'HH:mm'),
          isAvailable: true
        });
        
        current = addMinutes(slotEnd, gap);
        if (isAfter(current, end)) break;
      }
      return slots;
    };

    let allSlots: TimeSlot[] = [];
    if (timeRangeType === 'morning' || timeRangeType === 'full') {
      allSlots = [...allSlots, ...createSlotsInRange('09:30', '12:00')];
    }
    if (timeRangeType === 'afternoon' || timeRangeType === 'full') {
      allSlots = [...allSlots, ...createSlotsInRange('13:30', '17:00')];
    }

    await setDoc(doc(db, 'classes', classId, 'teacherAvailability', newDate), {
      date: newDate,
      slots: allSlots
    });
  };

  const toggleSlot = async (date: string, index: number) => {
    const availability = availabilities.find(a => a.date === date);
    if (!availability) return;

    const newSlots = [...availability.slots];
    newSlots[index].isAvailable = !newSlots[index].isAvailable;

    await updateDoc(doc(db, 'classes', classId, 'teacherAvailability', date), {
      slots: newSlots
    });
  };

  const deleteDate = async (date: string) => {
    if (window.confirm('この日の枠をすべて削除しますか？')) {
      await deleteDoc(doc(db, 'classes', classId, 'teacherAvailability', date));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-[#E1E2E4] shadow-sm">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Plus size={18} className="text-blue-600" />
            枠を一括作成
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#44474E] mb-1">日付</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#44474E] mb-1">時間帯</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'morning', label: '午前 (09:30 - 12:00)', icon: Clock },
                  { id: 'afternoon', label: '午後 (13:30 - 17:00)', icon: Clock },
                  { id: 'full', label: '全日 (午前・午後)', icon: Calendar },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setTimeRangeType(range.id as any)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
                      timeRangeType === range.id
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "bg-white border-[#E1E2E4] text-[#44474E] hover:bg-[#F8F9FA]"
                    )}
                  >
                    <range.icon size={16} />
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E1E2E4]">
              <p className="text-xs text-[#44474E] leading-relaxed">
                ※面談時間は<strong>15分固定</strong>、準備時間は<strong>5分</strong>で自動設定されます。
              </p>
            </div>
            <button
              onClick={handleAddSlots}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              枠を作成する
            </button>
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
            <Users size={18} />
            保護者用アンケート
          </h3>
          <p className="text-sm text-blue-700 mb-4 leading-relaxed">
            保護者に共有するURLです。回答依頼のお手紙も自動作成できます。
          </p>
          {window.location.origin.includes('-dev-') && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
              ⚠️ 現在「開発用URL」を表示しています。保護者に共有する際は、右上の「共有」ボタンから発行される「公開用URL（-pre-で始まるURL）」を使用してください。開発用URLは保護者の端末では開きません。
            </div>
          )}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div 
                className="flex-1 bg-white p-3 rounded-lg border border-blue-200 break-all text-xs font-mono text-blue-600 select-all cursor-pointer hover:bg-blue-50/40 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/#/parent/${classId}`);
                  alert('回答URLをコピーしました');
                }}
                title="クリックしてURLをコピー"
              >
                {window.location.origin}/#/parent/{classId}
              </div>
              <a 
                href={`${window.location.origin}/#/parent/${classId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors whitespace-nowrap"
                title="別のタブで保護者用の回答フォーム（アンケート）を開く"
              >
                テスト開く
              </a>
            </div>
            <Link
              to={`/request-letter/${classId}`}
              className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              <Printer size={16} />
              回答依頼の手紙を表示
            </Link>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {availabilities.map((avail) => (
          <div key={avail.date} className="bg-white rounded-2xl border border-[#E1E2E4] shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-[#F8F9FA] border-b border-[#E1E2E4] flex items-center justify-between">
              <h4 className="font-bold text-lg">
                {format(parse(avail.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })}
              </h4>
              <button
                onClick={() => deleteDate(avail.date)}
                className="text-[#44474E] hover:text-[#BA1A1A] p-1.5 hover:bg-[#FFDAD6] rounded-full transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {avail.slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => toggleSlot(avail.date, i)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                    slot.isAvailable
                      ? "bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
                      : "bg-[#F0F4F8] border-transparent text-[#44474E] opacity-50"
                  )}
                >
                  {slot.start} - {slot.end}
                </button>
              ))}
            </div>
          </div>
        ))}
        {availabilities.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#E1E2E4]">
            <p className="text-[#44474E]">まだ枠が作成されていません。</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ParentResponseList = ({ classId }: { classId: string }) => {
  const [responses, setResponses] = useState<ParentResponse[]>([]);

  useEffect(() => {
    const q = collection(db, 'classes', classId, 'parentResponses');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentResponse));
      setResponses(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });
    return unsubscribe;
  }, [classId]);

  return (
    <div className="bg-white rounded-2xl border border-[#E1E2E4] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E1E2E4] flex items-center justify-between">
        <h3 className="font-bold text-lg">回答状況（{responses.length}名）</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-[#F8F9FA] text-sm font-medium text-[#44474E]">
            <tr>
              <th className="px-6 py-3">児童・生徒名</th>
              <th className="px-6 py-3">希望面談形式</th>
              <th className="px-6 py-3">NGな時間枠数</th>
              <th className="px-6 py-3">面談で話したいこと</th>
              <th className="px-6 py-3">代替の日程希望</th>
              <th className="px-6 py-3">回答日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1E2E4]">
            {responses.map((r) => (
              <tr key={r.id} className="hover:bg-[#F8F9FA] transition-colors">
                <td className="px-6 py-4 font-medium">{r.studentName}</td>
                <td className="px-6 py-4 text-sm">
                  {r.wantsZoom ? (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-full inline-flex items-center gap-1">
                      💻 Zoom
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded-full inline-flex items-center gap-1">
                      🏫 対面
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-[#44474E]">{r.unavailableSlots.length}枠</td>
                <td className="px-6 py-4 text-sm text-[#44474E] max-w-[200px] truncate" title={r.talkTopics}>
                  {r.talkTopics || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-[#44474E] max-w-[200px] truncate" title={r.alternativeSchedule}>
                  {r.alternativeSchedule || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-[#44474E]">
                  {r.createdAt ? format(new Date(r.createdAt), 'M/d HH:mm', { locale: ja }) : '回答済み'}
                </td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[#44474E]">まだ回答がありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ScheduleManager = ({ classId }: { classId: string }) => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [breakInterval, setBreakInterval] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [allClassesResponses, setAllClassesResponses] = useState<{ [classId: string]: ParentResponse[] }>({});
  const [allSchedules, setAllSchedules] = useState<{ [classId: string]: Schedule }>({});
  const [allClassesInfo, setAllClassesInfo] = useState<{ [classId: string]: ClassInfo }>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'classes', classId, 'schedules', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data() as Schedule);
        setBreakInterval(docSnap.data().settings.breakInterval || 2);
      }
    });
    return unsub;
  }, [classId]);

  // Fetch all responses and schedules across all classes to detect siblings
  useEffect(() => {
    const fetchAllData = async () => {
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classIds = classesSnap.docs.map(d => d.id);
      
      const infoMap: { [classId: string]: ClassInfo } = {};
      classesSnap.docs.forEach(d => {
        infoMap[d.id] = d.data() as ClassInfo;
      });
      setAllClassesInfo(infoMap);

      classIds.forEach(id => {
        // Listen to responses
        onSnapshot(collection(db, 'classes', id, 'parentResponses'), (snap) => {
          const resps = snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentResponse));
          setAllClassesResponses(prev => ({ ...prev, [id]: resps }));
        });
        // Listen to schedules
        onSnapshot(doc(db, 'classes', id, 'schedules', 'current'), (snap) => {
          if (snap.exists()) {
            setAllSchedules(prev => ({ ...prev, [id]: snap.data() as Schedule }));
          }
        });
      });
    };
    fetchAllData();
  }, []);

  const getSiblingInfo = (studentName: string, currentClassId: string) => {
    if (!studentName || studentName === '（休憩）' || studentName === '（空き）') return null;
    
    // Find the current student's response to get their phone number
    const currentResponse = allClassesResponses[currentClassId]?.find(r => r.studentName === studentName);
    if (!currentResponse?.guardianPhone) return null;

    const siblings: { studentName: string; className: string; date: string | null; time?: string }[] = [];

    Object.entries(allClassesResponses).forEach(([cid, resps]) => {
      (resps as ParentResponse[]).forEach(r => {
        if (r.guardianPhone === currentResponse.guardianPhone && r.studentName !== studentName) {
          // Found a sibling. Now check if they are scheduled.
          const siblingSchedule = allSchedules[cid];
          const scheduledSlot = siblingSchedule?.slots.find(s => s.studentName === r.studentName);
          
          siblings.push({
            studentName: r.studentName,
            className: allClassesInfo[cid]?.name || cid,
            date: scheduledSlot ? scheduledSlot.date : null,
            time: scheduledSlot ? `${format(parse(scheduledSlot.date, 'yyyy-MM-dd', new Date()), 'M/d')} ${scheduledSlot.start}` : '未定'
          });
        }
      });
    });

    return siblings.length > 0 ? siblings : null;
  };

  const getStudentZoomRequest = (studentName: string) => {
    if (!studentName || studentName === '（休憩）' || studentName === '（空き）' || studentName === '') return false;
    const nameNoSpacing = studentName.replace(/\s+/g, '');
    const matched = allClassesResponses[classId]?.find(
      r => r.studentName.replace(/\s+/g, '') === nameNoSpacing
    );
    return matched?.wantsZoom || false;
  };

  const generateSchedule = async () => {
    setIsGenerating(true);
    try {
      // 1. Get Teacher Availability
      const availSnap = await getDocs(collection(db, 'classes', classId, 'teacherAvailability'));
      const availabilities = availSnap.docs.map(d => d.data() as TeacherAvailability);
      
      // 2. Get Parent Responses
      const respSnap = await getDocs(collection(db, 'classes', classId, 'parentResponses'));
      const responses = respSnap.docs.map(d => d.data() as ParentResponse);

      // 3. Simple Matching Algorithm
      const allAvailableSlots: ScheduleSlot[] = [];
      availabilities.forEach(a => {
        a.slots.filter(s => s.isAvailable).forEach(s => {
          allAvailableSlots.push({
            studentName: '',
            date: a.date,
            start: s.start,
            end: s.end,
            type: 'interview'
          });
        });
      });

      const resultSlots: ScheduleSlot[] = [];
      const unassignedStudents = [...responses];
      let interviewCount = 0;

      for (const slot of allAvailableSlots) {
        // Check if it's break time
        if (breakInterval > 0 && interviewCount > 0 && interviewCount % breakInterval === 0) {
          resultSlots.push({ ...slot, studentName: '（休憩）', type: 'break' });
          interviewCount = 0;
          continue;
        }

        // Find a student who is NOT NG for this slot
        const studentIndex = unassignedStudents.findIndex(s => 
          !s.unavailableSlots.some(ng => ng.date === slot.date && ng.start === slot.start)
        );

        if (studentIndex !== -1) {
          const student = unassignedStudents.splice(studentIndex, 1)[0];
          resultSlots.push({ ...slot, studentName: student.studentName, type: 'interview' });
          interviewCount++;
        } else {
          // No student available for this slot, leave it empty
          resultSlots.push({ ...slot, studentName: '（空き）', type: 'interview' });
        }
      }

      // Add remaining students if any
      unassignedStudents.forEach(s => {
        resultSlots.push({ studentName: s.studentName, date: '', start: '', end: '', type: 'interview' });
      });

      await setDoc(doc(db, 'classes', classId, 'schedules', 'current'), {
        slots: resultSlots,
        settings: { breakInterval }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSlot = async (index: number, studentName: string) => {
    if (!schedule) return;
    const newSlots = [...schedule.slots];
    newSlots[index].studentName = studentName;
    await updateDoc(doc(db, 'classes', classId, 'schedules', 'current'), {
      slots: newSlots
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-[#E1E2E4] shadow-sm">
        <h3 className="font-bold mb-4">自動作成設定</h3>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="block text-sm font-medium text-[#44474E] mb-2">休憩を入れる間隔</label>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map(val => (
                <button
                  key={val}
                  onClick={() => setBreakInterval(val)}
                  className={cn(
                    "px-4 py-2 rounded-lg border font-medium transition-all",
                    breakInterval === val
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-[#E1E2E4] text-[#44474E] hover:bg-[#F8F9FA]"
                  )}
                >
                  {val === 0 ? 'なし' : `${val}人おき`}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={generateSchedule}
            disabled={isGenerating}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isGenerating ? '作成中...' : 'スケジュールを自動作成する'}
          </button>
        </div>
      </div>

      {schedule && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">作成されたスケジュール</h3>
            <Link
              to={`/letter/${classId}`}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E1E2E4] text-[#1A1C1E] rounded-lg font-medium hover:bg-[#F8F9FA] transition-colors"
            >
              <Printer size={18} />
              お知らせの手紙を表示
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#E1E2E4] shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F8F9FA] text-sm font-medium text-[#44474E]">
                <tr>
                  <th className="px-6 py-3">日時</th>
                  <th className="px-6 py-3">時間</th>
                  <th className="px-6 py-3">児童・生徒名</th>
                  <th className="px-6 py-3">兄弟の状況</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E2E4]">
                {schedule.slots.map((slot, i) => {
                  const siblings = getSiblingInfo(slot.studentName, classId);
                  return (
                    <tr key={i} className={cn(
                      "hover:bg-[#F8F9FA] transition-colors",
                      slot.type === 'break' && "bg-gray-50 italic text-gray-500"
                    )}>
                      <td className="px-6 py-4 text-sm">
                        {slot.date ? format(parse(slot.date, 'yyyy-MM-dd', new Date()), 'M/d(E)', { locale: ja }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {slot.start ? `${slot.start} - ${slot.end}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={slot.studentName}
                            onChange={(e) => updateSlot(i, e.target.value)}
                            className="bg-transparent border-none focus:ring-0 font-medium p-0 min-w-0 flex-1"
                          />
                          {getStudentZoomRequest(slot.studentName) && (
                            <span className="flex-shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full select-none" title="Zoom面談を希望しています">
                              💻 Zoom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {siblings && siblings.map((sib, idx) => {
                          const isDifferentDay = sib.date && sib.date !== slot.date;
                          return (
                            <div key={idx} className="text-[10px] leading-tight text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-100 mb-1">
                              兄弟: {sib.studentName} ({sib.className})
                              {isDifferentDay && <span className="ml-1 text-red-600 bg-red-50 px-1 rounded">[別日]</span>}
                              <br/>
                              {sib.time}
                            </div>
                          );
                        })}
                      </td>
                      <td className="px-6 py-4">
                        {slot.studentName === '' && <span className="text-xs text-red-500 font-bold">未配置</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const ParentForm = () => {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([]);
  const [studentName, setStudentName] = useState(() => localStorage.getItem(`draft_student_name_${classId}`) || '');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [ngSlots, setNgSlots] = useState<{ date: string; start: string; end: string }[]>([]);
  const [talkTopics, setTalkTopics] = useState('');
  const [alternativeSchedule, setAlternativeSchedule] = useState('');
  const [wantsZoom, setWantsZoom] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (classId) localStorage.setItem(`draft_student_name_${classId}`, studentName);
  }, [studentName, classId]);

  useEffect(() => {
    if (!classId) return;
    getDoc(doc(db, 'classes', classId)).then(docSnap => {
      if (docSnap.exists()) setClassInfo({ id: docSnap.id, ...docSnap.data() } as ClassInfo);
    });
    const q = collection(db, 'classes', classId, 'teacherAvailability');
    getDocs(q).then(snapshot => {
      const list = snapshot.docs.map(doc => doc.data() as TeacherAvailability);
      setAvailabilities(list.sort((a, b) => a.date.localeCompare(b.date)));
    });
  }, [classId]);

  const toggleNg = (date: string, start: string, end: string) => {
    const isNg = ngSlots.some(s => s.date === date && s.start === start);
    if (isNg) {
      setNgSlots(ngSlots.filter(s => !(s.date === date && s.start === start)));
    } else {
      setNgSlots([...ngSlots, { date, start, end }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !classId) return;

    const normalized = studentName.replace(/\s+/g, '');
    const qNormalized = query(
      collection(db, 'classes', classId, 'parentResponses'),
      where('normalizedStudentName', '==', normalized)
    );
    const qExact = query(
      collection(db, 'classes', classId, 'parentResponses'),
      where('studentName', '==', studentName)
    );
    
    const [snapNormalized, snapExact] = await Promise.all([
      getDocs(qNormalized),
      getDocs(qExact)
    ]);
    
    // Combine unique document IDs
    const existingDocIds = new Set([
      ...snapNormalized.docs.map(d => d.id),
      ...snapExact.docs.map(d => d.id)
    ]);

    const responseData = {
      studentName,
      normalizedStudentName: normalized,
      guardianPhone,
      talkTopics,
      alternativeSchedule,
      wantsZoom,
      unavailableSlots: ngSlots,
      createdAt: new Date().toISOString()
    };

    if (existingDocIds.size > 0) {
      const ids = Array.from(existingDocIds);
      const firstId = ids[0];
      const otherIds = ids.slice(1);
      
      await setDoc(doc(db, 'classes', classId, 'parentResponses', firstId), responseData);
      for (const id of otherIds) {
        await deleteDoc(doc(db, 'classes', classId, 'parentResponses', id));
      }
    } else {
      await addDoc(collection(db, 'classes', classId, 'parentResponses'), responseData);
    }

    setSubmitted(true);
    localStorage.removeItem(`draft_student_name_${classId}`);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-4">回答ありがとうございます</h2>
        <p className="text-[#44474E]">
          面談希望の回答を受け付けました。日程が確定しましたら、後日お知らせいたします。
        </p>
      </div>
    );
  }

  if (!classInfo) return <div className="text-center py-20">読み込み中...</div>;

  const allSlotsCount = availabilities.reduce((acc, curr) => acc + curr.slots.filter(s => s.isAvailable).length, 0);
  const isAllNg = ngSlots.length === allSlotsCount && allSlotsCount > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-8 rounded-3xl border border-[#E1E2E4] shadow-sm mb-8">
        <h2 className="text-2xl font-bold mb-2">{classInfo.name} 個人面談アンケート</h2>
        <p className="text-[#44474E] mb-8 leading-relaxed">
          いつもお世話になっております。個人面談の日程調整のため、ご都合の悪い（面談ができない）時間帯を選択してください。
          <br /><span className="text-sm text-blue-600 font-medium">※選択した枠は「NG（不可）」として扱われます。</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-bold text-[#1A1C1E] mb-2">児童・生徒名</label>
            <input
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full px-4 py-3 border border-[#E1E2E4] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1A1C1E] mb-2">
              保護者の電話番号（兄弟紐付け用）
            </label>
            <p className="text-xs text-[#44474E] mb-2">
              ※兄弟が同じ学校にいる場合、同じ番号を入力してください。面談時間を近づけるための調整に使用します。
            </p>
            <input
              type="tel"
              required
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="例：09012345678"
              className="w-full px-4 py-3 border border-[#E1E2E4] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50/40 p-6 rounded-2xl border border-blue-100 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-bold text-[#1A1C1E]">面談形式の希望</label>
              <p className="text-xs text-[#44474E] mt-1">
                ※Zoomでのオンライン面談を希望される場合は「オンライン（Zoom）面談」を選択してください。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all bg-white",
                !wantsZoom
                  ? "border-blue-600 ring-2 ring-blue-100 text-blue-950"
                  : "border-[#E1E2E4] text-[#44474E] hover:border-gray-200"
              )}>
                <input
                  type="radio"
                  name="interview_type"
                  checked={!wantsZoom}
                  onChange={() => setWantsZoom(false)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="text-left select-none">
                  <p className="font-bold text-sm">🏫 対面（教室）での面談</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">学校の各教室にて、直接対面で面談を行います。</p>
                </div>
              </label>

              <label className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all bg-white",
                wantsZoom
                  ? "border-blue-600 ring-2 ring-blue-100 text-blue-950"
                  : "border-[#E1E2E4] text-[#44474E] hover:border-gray-200"
              )}>
                <input
                  type="radio"
                  name="interview_type"
                  checked={wantsZoom}
                  onChange={() => setWantsZoom(true)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="text-left select-none">
                  <p className="font-bold text-sm text-blue-600">💻 オンライン（Zoom）面談</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Zoomビデオ会議ツールを利用してオンラインで実施します。</p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <label className="block text-sm font-bold text-[#1A1C1E]">ご都合の悪い時間帯を選択してください</label>
            {availabilities.map((avail) => (
              <div key={avail.date} className="space-y-3">
                <h4 className="font-bold text-[#44474E] border-l-4 border-blue-500 pl-3">
                  {format(parse(avail.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {avail.slots.filter(s => s.isAvailable).map((slot, i) => {
                    const isNg = ngSlots.some(s => s.date === avail.date && s.start === slot.start);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleNg(avail.date, slot.start, slot.end)}
                        className={cn(
                          "px-3 py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-between",
                          isNg
                            ? "bg-[#FFDAD6] border-[#BA1A1A] text-[#BA1A1A]"
                            : "bg-white border-[#E1E2E4] text-[#44474E] hover:border-blue-300"
                        )}
                      >
                        {slot.start}
                        {isNg ? <X size={14} /> : <div className="w-3.5 h-3.5 border border-[#E1E2E4] rounded-sm" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {isAllNg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-orange-50 border border-orange-200 rounded-2xl">
                  <label className="block text-sm font-bold text-orange-800 mb-2">
                    代替の日程希望
                  </label>
                  <p className="text-xs text-orange-700 mb-3">
                    ※すべての日程がNGの場合のみご記入ください。必ずしもご希望に沿えるとは限りませんので、あらかじめご了承ください。
                  </p>
                  <textarea
                    value={alternativeSchedule}
                    onChange={(e) => setAlternativeSchedule(e.target.value)}
                    placeholder="例：○月○日の16時以降であれば可能です、など"
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[100px]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-sm font-bold text-[#1A1C1E] mb-2">面談で話したいこと（任意）</label>
            <textarea
              value={talkTopics}
              onChange={(e) => setTalkTopics(e.target.value)}
              placeholder="例：学校での様子、学習面について、など"
              className="w-full px-4 py-3 border border-[#E1E2E4] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-md active:scale-[0.98]"
          >
            回答を送信する
          </button>
        </form>
      </div>
    </div>
  );
};

const RequestLetterView = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([]);

  useEffect(() => {
    if (!classId) return;
    getDoc(doc(db, 'classes', classId)).then(docSnap => {
      if (docSnap.exists()) setClassInfo({ id: docSnap.id, ...docSnap.data() } as ClassInfo);
    });
    const q = collection(db, 'classes', classId, 'teacherAvailability');
    getDocs(q).then(snapshot => {
      const list = snapshot.docs.map(doc => doc.data() as TeacherAvailability);
      setAvailabilities(list.sort((a, b) => a.date.localeCompare(b.date)));
    });
  }, [classId]);

  const handleSavePdf = () => {
    const element = document.getElementById('letter-content');
    if (!element) return;
    
    const opt = {
      margin: 10,
      filename: `面談回答依頼_${classInfo?.name || ''}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (!classInfo) return <div className="text-center py-20">読み込み中...</div>;

  const parentUrl = `${window.location.origin}/#/parent/${classId}`;

  return (
    <div className="max-w-4xl mx-auto py-8">
      {window.location.origin.includes('-dev-') && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium print:hidden">
          ⚠️ 現在「開発用URL」で手紙を作成しています。このまま配布すると保護者の端末でエラー（403）が表示されます。
          <br />
          右上の「共有」ボタンから発行される「公開用URL（-pre-で始まるURL）」の管理画面からお手紙を作成してください。
        </div>
      )}
      
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-2.5 print:hidden shadow-sm">
        <span className="text-lg">💡</span>
        <div>
          <p className="font-bold mb-0.5">手紙の内容をお好みに合わせてその場で直接編集できます</p>
          <p className="text-xs text-blue-700">お名前、学校名、タイトル、本文、注意書きなど、手紙の任意の文字をクリックするとキーボード操作で自由に書き換えることができます。編集内容は印刷やPDF保存にそのまま反映されます。（日時や動的なリンクURLは変更しないでください）</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 print:hidden">
        <button
          onClick={() => navigate(`/teacher/class/${classId}`)}
          className="flex items-center gap-2 px-4 py-2 text-[#44474E] hover:bg-gray-100 rounded-lg transition-colors font-medium"
        >
          <X size={18} />
          管理画面に戻る
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            <Printer size={18} />
            印刷
          </button>
          <button
            onClick={handleSavePdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FileText size={18} />
            PDFで保存
          </button>
        </div>
      </div>

      <div id="letter-content" className="bg-white p-12 shadow-lg min-h-[297mm] print:shadow-none print:p-0">
        <div className="text-right mb-8">
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded inline-block cursor-text hover:border-b hover:border-gray-300 min-w-[120px] transition-colors">{format(new Date(), 'yyyy年M月d日')}</p>
        </div>

        <div className="mb-12">
          <p contentEditable suppressContentEditableWarning className="text-lg outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">保護者 各位</p>
          <p contentEditable suppressContentEditableWarning className="text-right outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">{classInfo.schoolName || '（学校名）'}</p>
          <p contentEditable suppressContentEditableWarning className="text-right outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">{classInfo.name} 担任 {classInfo.teacherName ? `${classInfo.teacherName}` : '（氏名）'}</p>
        </div>

        <h1 contentEditable suppressContentEditableWarning className="text-2xl font-bold text-center mb-12 underline underline-offset-8 outline-none focus:bg-blue-50/50 p-2 rounded cursor-text hover:border hover:border-gray-300 transition-colors">個人面談の実施について（お願い）</h1>

        <p contentEditable suppressContentEditableWarning className="mb-8 leading-relaxed outline-none focus:bg-blue-50/50 p-2 rounded cursor-text hover:border hover:border-gray-300 transition-colors">
          拝啓 時下ますますご清祥のこととお慶び申し上げます。日頃より本校の教育活動にご理解とご協力をいただき、厚く御礼申し上げます。<br />
          さて、本年度も下記の日程にて個人面談を実施いたします。つきましては、日程調整のため、ご都合の悪い（面談ができない）時間帯を以下のアンケートよりご回答くださいますようお願い申し上げます。
        </p>

        <div className="border-2 border-black p-8 mb-8">
          <p contentEditable suppressContentEditableWarning className="text-center font-bold mb-6 text-xl outline-none focus:bg-blue-50/50 p-1 rounded cursor-text transition-colors">記</p>
          <div className="space-y-4 mb-8">
            <p className="font-bold">1. 実施日時</p>
            <div className="pl-4 space-y-1">
              {availabilities.map((avail, i) => (
                <p key={i}>
                  {format(parse(avail.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })}
                  {' '}
                  {avail.slots[0].start} ～ {avail.slots[avail.slots.length - 1].end}
                </p>
              ))}
            </div>
            
            <p className="font-bold">2. 回答方法</p>
            <div className="pl-4">
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">以下のURL、または右記のQRコードよりアクセスし、ご回答ください。</p>
              <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 w-full">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded break-all font-mono text-sm shadow-sm hover:border-blue-300 transition-colors">
                    <a 
                      href={parentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      title="保護者用回答アンケート画面（別タブで開く）"
                    >
                      <span>{parentUrl}</span>
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center p-2.5 border border-gray-200 rounded-lg bg-white shadow-sm flex-shrink-0 w-[140px]">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(parentUrl)}`} 
                    alt="QR Code" 
                    className="w-[110px] h-[110px]"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 font-sans font-medium">スマホ回答用のQRコード</span>
                </div>
              </div>
            </div>
            
            <p className="font-bold">3. 回答期限</p>
            <div className="pl-4">
              <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">
                {classInfo.deadline 
                  ? format(parse(classInfo.deadline, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })
                  : '（月） （日）'}
                まで
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-sm text-gray-600 space-y-1">
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">※日程が確定しましたら、後日改めてお知らせいたします。</p>
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">※インターネット環境がない場合は、連絡帳等にてお知らせください。</p>
        </div>
      </div>
    </div>
  );
};

const LetterView = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    if (!classId) return;
    getDoc(doc(db, 'classes', classId)).then(docSnap => {
      if (docSnap.exists()) setClassInfo({ id: docSnap.id, ...docSnap.data() } as ClassInfo);
    });
    getDoc(doc(db, 'classes', classId, 'schedules', 'current')).then(docSnap => {
      if (docSnap.exists()) setSchedule(docSnap.data() as Schedule);
    });
  }, [classId]);

  const handleSavePdf = () => {
    const element = document.getElementById('schedule-letter-content');
    if (!element) return;
    
    const opt = {
      margin: 10,
      filename: `面談日程お知らせ_${classInfo?.name || ''}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (!classInfo || !schedule) return <div className="text-center py-20">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-2.5 print:hidden shadow-sm">
        <span className="text-lg">💡</span>
        <div>
          <p className="font-bold mb-0.5">お手紙の内容をその場で直接編集できます</p>
          <p className="text-xs text-blue-700">お名前、学校名、タイトル、本文、注意書きなど、手紙の任意の文字をクリックするとキーボード操作で自由に書き換えることができます。編集内容は印刷やPDF保存にそのまま反映されます。（決定された面談枠の日時は変更しないでください）</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 print:hidden">
        <button
          onClick={() => navigate(`/teacher/class/${classId}`)}
          className="flex items-center gap-2 px-4 py-2 text-[#44474E] hover:bg-gray-100 rounded-lg transition-colors font-medium"
        >
          <X size={18} />
          管理画面に戻る
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            <Printer size={18} />
            印刷
          </button>
          <button
            onClick={handleSavePdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FileText size={18} />
            PDFで保存
          </button>
        </div>
      </div>

      <div id="schedule-letter-content" className="bg-white p-12 shadow-lg min-h-[297mm] print:shadow-none print:p-0">
        <div className="text-right mb-8">
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded inline-block cursor-text hover:border-b hover:border-gray-300 min-w-[120px] transition-colors">{format(new Date(), 'yyyy年M月d日')}</p>
        </div>

        <div className="mb-12">
          <p contentEditable suppressContentEditableWarning className="text-lg outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">保護者 各位</p>
          <p contentEditable suppressContentEditableWarning className="text-right outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">{classInfo.schoolName || '（学校名）'}</p>
          <p contentEditable suppressContentEditableWarning className="text-right outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">{classInfo.name} 担任 {classInfo.teacherName ? `${classInfo.teacherName}` : '（氏名）'}</p>
        </div>

        <h1 contentEditable suppressContentEditableWarning className="text-2xl font-bold text-center mb-12 underline underline-offset-8 outline-none focus:bg-blue-50/50 p-2 rounded cursor-text hover:border hover:border-gray-300 transition-colors">個人面談の日程について（お知らせ）</h1>

        <p contentEditable suppressContentEditableWarning className="mb-8 leading-relaxed outline-none focus:bg-blue-50/50 p-2 rounded cursor-text hover:border hover:border-gray-300 transition-colors">
          拝啓 時下ますますご清祥のこととお慶び申し上げます。日頃より本校の教育活動にご理解とご協力をいただき、厚く御礼申し上げます。<br />
          さて、先日アンケートにてご回答いただきました個人面談の日程が、下記の通り決定いたしましたのでお知らせいたします。<br />
          お忙しい中とは存じますが、万障お繰り合わせの上、ご来校くださいますようお願い申し上げます。
        </p>

        <div className="border-2 border-black p-8">
          <p contentEditable suppressContentEditableWarning className="text-center font-bold mb-6 text-xl outline-none focus:bg-blue-50/50 p-1 rounded cursor-text transition-colors">記</p>
          <div className="space-y-4">
            {schedule.slots.filter(s => s.type === 'interview' && s.studentName && !s.studentName.includes('（')).sort((a,b) => {
              if (a.date !== b.date) return a.date.localeCompare(b.date);
              return a.start.localeCompare(b.start);
            }).map((slot, i) => (
              <div key={i} className="flex border-b border-gray-200 pb-2">
                <div className="w-1/3 font-bold text-gray-800">
                  {format(parse(slot.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })}
                </div>
                <div className="w-1/3 text-gray-700">
                  {slot.start} ～ {slot.end}
                </div>
                <div className="w-1/3 text-right font-medium">
                  {slot.studentName} 様
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-sm text-gray-600 space-y-1">
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">※ご都合が悪くなった場合は、お早めに担任までご連絡ください。</p>
          <p contentEditable suppressContentEditableWarning className="outline-none focus:bg-blue-50/50 p-1 rounded cursor-text hover:border-b hover:border-gray-300 transition-colors">※面談場所は各教室となります。</p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teacher/class/:classId" element={<ClassManagement />} />
          <Route path="/parent/:classId" element={<ParentForm />} />
          <Route path="/request-letter/:classId" element={<RequestLetterView />} />
          <Route path="/letter/:classId" element={<LetterView />} />
        </Routes>
      </Layout>
    </Router>
  );
}
