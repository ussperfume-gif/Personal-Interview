import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Calendar, Users, FileText, Settings, LogIn, LogOut, Plus, Trash2, Check, X, ChevronRight, Copy, Printer, Clock, Save, GripVertical, Download, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { format, addMinutes, parse, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Utils ---
const memoryStorage: Record<string, string> = {};

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      memoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete memoryStorage[key];
    }
  }
};

const getTeacherId = () => {
  let id = safeStorage.getItem('teacher_id');
  if (!id) {
    id = 't_' + Math.random().toString(36).substring(2, 15);
    safeStorage.setItem('teacher_id', id);
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
    zoomGroupingPolicy?: 'none' | 'one_place' | 'time_only';
  };
}

// --- Components ---

const PdfGuideModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "PDF保存・印刷のやり方"
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 print:hidden overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-lg rounded-2xl border border-gray-100 p-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="閉じる"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4 text-blue-600">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <FileText size={22} className="text-blue-600 animate-pulse" />
          </div>
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-[#44474E] leading-relaxed">
            お使いのブラウザやセキュリティ制限の影響を受けず、<strong>100%確実かつ高画質な（文字のコピーや拡大が綺麗でボケない）PDFファイル</strong>を保存する手順です。
          </p>

          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 text-xs text-amber-900 leading-relaxed space-y-2">
            <div className="flex gap-2 font-bold mb-1 items-center">
              <span>💡</span>
              <span>2ステップで完了：</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 pl-1">
              <li>
                下の <span className="font-bold text-blue-700">「印刷・PDF保存画面を開く」</span> ボタンを押します。
              </li>
              <li>
                直後に表示される印刷メニューの面（送信先やプリンターなどの項目）で、<span className="font-bold text-amber-800 bg-amber-100/50 px-1 py-0.5 rounded">「PDFとして保存」</span> もしくは <span className="font-bold text-amber-800 bg-amber-100/50 px-1 py-0.5 rounded">「PDFを保存」</span> を選択して決定します。
              </li>
            </ol>
          </div>

          <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed space-y-1">
            <p>※ 印刷設定の用紙サイズは<strong>「A4 (縦)」</strong>、倍率は<strong>「100%（デフォルト）」</strong>が最適です。</p>
            <p>※ 「詳細設定」内の<strong>「ヘッダーとフッター」のチェックを外す</strong>と、ページ上部の日時や下部のURLなどの不要な表示が消え、お便りだけが本当に綺麗に保存できます。</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
          >
            <Printer size={16} />
            印刷・PDF保存画面を開く
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isParentView = location.pathname.includes('/parent/');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1C1E] font-sans print:bg-white print:min-h-0">
      <header className="bg-white border-b border-[#E1E2E4] sticky top-0 z-50 print:hidden">
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
      <main className="max-w-7xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
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
  const [newClassName, setNewClassName] = useState(() => safeStorage.getItem('draft_class_name') || '');
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const teacherId = getTeacherId();

  useEffect(() => {
    safeStorage.setItem('draft_class_name', newClassName);
  }, [newClassName]);

  useEffect(() => {
    const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo))
        .filter(c => !c.id.startsWith('settings_'));
      setClasses(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId) return;
    
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'classes', 'settings_' + teacherId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSchoolName(data.schoolName || '');
          setDeadline(data.deadline || '');
        } else {
          // Fallback to migrating from existing classes if any
          const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
          const snap = await getDocs(q);
          const list = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo))
            .filter(c => !c.id.startsWith('settings_'));
          const classWithSchool = list.find(c => c.schoolName || c.deadline);
          if (classWithSchool) {
            setSchoolName(classWithSchool.schoolName || '');
            setDeadline(classWithSchool.deadline || '');
          }
        }
      } catch (e) {
        console.error("Error fetching teacher settings:", e);
      }
    };
    
    fetchSettings();
  }, [teacherId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      // 1. Save in a virtual settings document under the classes collection
      await setDoc(doc(db, 'classes', 'settings_' + teacherId), {
        schoolName,
        deadline
      }, { merge: true });

      // 2. Get all classes of this teacher and update them
      const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
      const snap = await getDocs(q);
      const updatePromises = snap.docs
        .filter(docSnap => !docSnap.id.startsWith('settings_'))
        .map(docSnap => {
          return updateDoc(doc(db, 'classes', docSnap.id), {
            schoolName,
            deadline
          });
        });
      await Promise.all(updatePromises);

      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert('共通設定の保存に失敗しました。\nエラー内容: ' + (err?.message || err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    await addDoc(collection(db, 'classes'), {
      name: newClassName,
      teacherId: teacherId,
      createdAt: new Date().toISOString(),
      schoolName,
      deadline
    });
    setNewClassName('');
    safeStorage.removeItem('draft_class_name');
  };

  const handleDeleteClass = async (id: string) => {
    if (window.confirm('このクラスを削除しますか？')) {
      await deleteDoc(doc(db, 'classes', id));
    }
  };

  if (loading) return <div className="flex justify-center py-20">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">担当クラス一覧</h2>
        <form onSubmit={handleCreateClass} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="クラス名（例：1年A組）"
            className="flex-1 sm:flex-initial px-4 py-2 border border-[#E1E2E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm shrink-0 shadow-xs"
          >
            <Plus size={18} />
            追加
          </button>
        </form>
      </div>

      {/* 共通設定カード */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-blue-200/80 shadow-xs mb-8">
        <div className="flex items-center gap-2 mb-4 text-slate-800">
          <span className="text-lg">🏫</span>
          <h3 className="font-bold text-base md:text-lg">全クラス共通の設定（学校名・締め切り）</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">共通の学校名</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="例：○○市立○○小学校"
              className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">共通の回答期限</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-[#E1E2E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center md:items-stretch lg:items-center gap-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-950 disabled:bg-slate-300 text-white rounded-lg font-bold transition-all text-sm shadow-xs"
            >
              <Save size={16} />
              {isSavingSettings ? '保存中...' : '設定を同期・保存'}
            </button>
            {showSaveSuccess && (
              <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1.5 rounded-lg animate-fade-in flex items-center justify-center gap-1">
                <Check size={14} />
                同期完了
              </span>
            )}
          </div>
        </form>
        <p className="text-[11px] text-gray-400 mt-2.5 leading-relaxed">
          ※ここで保存した値は、現在登録されている<b>すべてのクラス</b>、および<b>今後追加する新規クラス</b>に自動で適用されます。
        </p>
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

      {/* 端末間でのデータ共有（同期） */}
      <div className="mt-8 bg-white p-6 rounded-2xl border border-blue-200 shadow-sm animate-fade-in">
        <div className="flex items-center gap-2 mb-3 text-blue-800">
          <span className="text-xl">🛜</span>
          <h4 className="font-bold text-base">他の端末（スマホ、別のPC、タブレット等）とデータを同期・共有する</h4>
        </div>
        <p className="text-xs text-[#44474E] leading-relaxed mb-4">
          本アプリはお使いのブラウザごとに管理用コード（管理ID）を自動作成してデータを区別しています。
          そのため、別のパソコンやスマートフォンで開くと空の画面になりますが、<strong>以下の同期方法を行うことで、どの端末からでも同じクラス・面談スケジュールを管理・リアルタイム編集できるようになります。</strong>
        </p>

        <div className="flex flex-col md:flex-row items-stretch gap-5 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
          {/* Method 1: QR Code Scan */}
          <div className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-xl bg-white shadow-xs w-full md:w-[150px] flex-shrink-0">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/sync/${teacherId}`)}`} 
              alt="Sync QR Code" 
              className="w-[110px] h-[110px]"
              referrerPolicy="no-referrer"
            />
            <span className="text-[10px] text-gray-500 mt-2 font-bold text-center">💻 スマホで読み込む</span>
          </div>

          {/* Method 2: Link Share */}
          <div className="flex-1 w-full flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-bold text-[#1A1C1E] mb-1">他のパソコンやタブレットで開く同期用URL:</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white p-2.5 px-3 rounded-lg border border-gray-200 break-all text-[11px] font-mono text-blue-600 select-all shadow-xs leading-normal flex items-center">
                  {window.location.origin}/#/sync/{teacherId}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/#/sync/${teacherId}`);
                    alert('同期キーを含んだURLをコピーしました！このURLをメールやSlack、LINEなどで他の端末に送り、そちらのブラウザで開いてください。');
                  }}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-xs active:scale-95"
                >
                  URLをコピー
                </button>
              </div>
            </div>
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <p>※同期作業は最初の1回だけでOKです。以降、どの端末からでも同じデータにアクセスでき、自動更新されます。</p>
              <p className="text-blue-700 font-medium">※保護者用の回答用リンクとは異なります。本リンクは「先生の管理画面」を同期するためのリンクですので、保護者には共有しないでください。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClassManagement = () => {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'availability' | 'responses' | 'schedule'>(() => (safeStorage.getItem(`active_tab_${classId}`) as any) || 'availability');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({ schoolName: '', teacherName: '', name: '', deadline: '' });

  useEffect(() => {
    if (classId) safeStorage.setItem(`active_tab_${classId}`, activeTab);
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
  const [showCsvBox, setShowCsvBox] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = collection(db, 'classes', classId, 'parentResponses');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentResponse));
      setResponses(list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    });
    return unsubscribe;
  }, [classId]);

  // CSV Export
  const handleExportCSV = () => {
    if (responses.length === 0) {
      alert('エクスポートするデータがありません。');
      return;
    }

    const csvRows = [];
    const headers = ["児童・生徒名", "保護者氏名", "保護者連絡先", "保護者メールアドレス", "希望面談形式", "面談で話したいこと", "代替の日程希望", "NGな時間帯", "回答日時"];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    for (const r of responses) {
      const ngSlotsStr = (r.unavailableSlots || [])
        .map(s => `${s.date} ${s.start}-${s.end}`)
        .join(' | ');

      const formatInterview = r.wantsZoom ? "オンライン（Zoom）面談" : "対面での面談";
      let dateFormatted = '';
      if (r.createdAt) {
        try {
          dateFormatted = format(new Date(r.createdAt), 'yyyy/MM/dd HH:mm:ss');
        } catch (e) {
          dateFormatted = r.createdAt;
        }
      }

      const row = [
        r.studentName || '',
        r.guardianName || '',
        r.guardianPhone || '',
        r.parentEmail || '',
        formatInterview,
        r.talkTopics || '',
        r.alternativeSchedule || '',
        ngSlotsStr,
        dateFormatted
      ];

      csvRows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `保護者回答一覧_クラス_${classId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const csvRows = [];
    const headers = ["児童・生徒名", "保護者氏名", "保護者連絡先", "保護者メールアドレス", "希望面談形式", "面談で話したいこと", "代替の日程希望", "NGな時間帯", "回答日時"];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
    
    const samples = [
      [
        "山田 太郎",
        "山田 花子",
        "090-1234-5678",
        "yamada@example.com",
        "対面での面談",
        "国語と算数の成績の件と、家でのスマートフォンの利用時間について相談したいです。",
        "",
        "2026-06-04 10:00-10:20 | 2026-06-04 10:30-10:50",
        "2026-06-04 10:00:00"
      ],
      [
        "佐藤 花子",
        "佐藤 二郎",
        "080-9876-5432",
        "sato@example.com",
        "オンライン（Zoom）面談",
        "交友関係について。",
        "夕方の遅い時間か、別日の午前中が助かります。",
        "",
        "2026-06-04 10:15:22"
      ]
    ];

    for (const sample of samples) {
      csvRows.push(sample.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `面談アンケート回答_インポート用テンプレート.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV rows considering quotes and commas
  const parseCSVRow = (string: string) => {
    const arr = [];
    let quote = false;
    let col = '';
    for (let i = 0; i < string.length; i++) {
      const char = string[i];
      if ((char === '"' || char === "'") && (i === 0 || string[i-1] !== '\\')) {
        quote = !quote;
      } else if (char === ',' && !quote) {
        arr.push(col.trim());
        col = '';
      } else {
        col += char;
      }
    }
    arr.push(col.trim());
    return arr;
  };

  // Main import handler
  const parseAndUploadCSV = async (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        alert('CSVファイルが空か、有効な形式ではありません。');
        return;
      }

      // Read header
      const header = lines[0].replace(/"/g, '').split(',');
      const rows = lines.slice(1);

      const colIndices = {
        studentName: header.findIndex(h => h.includes('児童') || h.includes('生徒') || h.includes('名前')),
        guardianName: header.findIndex(h => h.includes('保護者氏名') || h.includes('保護者名')),
        guardianPhone: header.findIndex(h => h.includes('連絡先') || h.includes('電話')),
        parentEmail: header.findIndex(h => h.includes('メール') || h.includes('アドレス')),
        wantsZoom: header.findIndex(h => h.includes('形') || h.includes('面談形式') || h.includes('Zoom')),
        talkTopics: header.findIndex(h => h.includes('話したい') || h.includes('要望') || h.includes('トピック')),
        alternativeSchedule: header.findIndex(h => h.includes('代替') || h.includes('希望日')),
        unavailableSlots: header.findIndex(h => h.includes('NG') || h.includes('時間帯') || h.includes('都合の悪い')),
        createdAt: header.findIndex(h => h.includes('日時'))
      };

      // Fallbacks
      if (colIndices.studentName === -1) colIndices.studentName = 0;
      if (colIndices.wantsZoom === -1) colIndices.wantsZoom = 4;

      let importCount = 0;
      const batchPromises = [];

      for (const row of rows) {
        if (!row.trim()) continue;

        const cols = parseCSVRow(row);
        
        const studentName = colIndices.studentName !== -1 && cols[colIndices.studentName] ? cols[colIndices.studentName].replace(/^["']|["']$/g, '') : '';
        if (!studentName) continue; // Skip if no student name

        const guardianName = colIndices.guardianName !== -1 && cols[colIndices.guardianName] ? cols[colIndices.guardianName].replace(/^["']|["']$/g, '') : '';
        const guardianPhone = colIndices.guardianPhone !== -1 && cols[colIndices.guardianPhone] ? cols[colIndices.guardianPhone].replace(/^["']|["']$/g, '') : '';
        const parentEmail = colIndices.parentEmail !== -1 && cols[colIndices.parentEmail] ? cols[colIndices.parentEmail].replace(/^["']|["']$/g, '') : '';
        
        const wantsZoomStr = colIndices.wantsZoom !== -1 && cols[colIndices.wantsZoom] ? cols[colIndices.wantsZoom].replace(/^["']|["']$/g, '') : '';
        const wantsZoom = wantsZoomStr.includes('Zoom') || wantsZoomStr.includes('オンライン') || wantsZoomStr.includes('はい') || wantsZoomStr.includes('true') || wantsZoomStr.includes('💻');

        const talkTopics = colIndices.talkTopics !== -1 && cols[colIndices.talkTopics] ? cols[colIndices.talkTopics].replace(/^["']|["']$/g, '') : '';
        const alternativeSchedule = colIndices.alternativeSchedule !== -1 && cols[colIndices.alternativeSchedule] ? cols[colIndices.alternativeSchedule].replace(/^["']|["']$/g, '') : '';
        
        // Parse unavailable Slots (NG時間帯) "2026-06-04 10:00-10:20 | 2026-06-04 10:30-10:50"
        const unavailableSlotsStr = colIndices.unavailableSlots !== -1 && cols[colIndices.unavailableSlots] ? cols[colIndices.unavailableSlots].replace(/^["']|["']$/g, '') : '';
        const unavailableSlots: { date: string; start: string; end: string }[] = [];
        
        if (unavailableSlotsStr) {
          const slotsParts = unavailableSlotsStr.split('|');
          for (const item of slotsParts) {
            const trimmedItem = item.trim();
            const match = trimmedItem.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
            if (match) {
              unavailableSlots.push({
                date: match[1],
                start: match[2],
                end: match[3]
              });
            }
          }
        }

        const createdAtStr = colIndices.createdAt !== -1 && cols[colIndices.createdAt] ? cols[colIndices.createdAt].replace(/^["']|["']$/g, '') : '';
        const createdAt = createdAtStr ? new Date(createdAtStr).toISOString() : new Date().toISOString();

        const responseData = {
          studentName,
          guardianName,
          guardianPhone,
          parentEmail,
          wantsZoom,
          talkTopics,
          alternativeSchedule,
          unavailableSlots,
          createdAt
        };

        // If a response with the same student name exists, overwrite it, otherwise add new
        const existing = responses.find(r => r.studentName.replace(/\s+/g, '') === studentName.replace(/\s+/g, ''));
        if (existing) {
          batchPromises.push(setDoc(doc(db, 'classes', classId, 'parentResponses', existing.id), responseData));
        } else {
          batchPromises.push(addDoc(collection(db, 'classes', classId, 'parentResponses'), responseData));
        }
        importCount++;
      }

      if (batchPromises.length > 0) {
        await Promise.all(batchPromises);
        alert(`CSVから【${importCount}件】の回答をインポート・更新しました。`);
        setShowCsvBox(false);
      } else {
        alert('有効な児童・生徒データの行が見つかりませんでした。');
      }
    } catch (err) {
      console.error(err);
      alert('CSVファイルのパース中にエラーが発生しました。UTF-8形式で保存されているか、フォーマットが正しいか確認してください。');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('アップロードできるのはCSVファイル (.csv) のみです。');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) parseAndUploadCSV(text);
    };
    reader.readAsText(file);
  };

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeaveFile = () => {
    setIsDragOver(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E1E2E4] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E1E2E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <h3 className="font-bold text-lg text-[#1A1C1E] flex items-center gap-2">
          <span>回答状況（{responses.length}名）</span>
        </h3>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-all shadow-xs"
            title="現在の回答をCSVファイルとしてダウンロードします"
          >
            <Download size={13} />
            CSVダウンロード
          </button>
          
          <button
            type="button"
            onClick={() => setShowCsvBox(!showCsvBox)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs border",
              showCsvBox 
                ? "bg-blue-50 border-blue-200 text-blue-700" 
                : "bg-blue-600 hover:bg-blue-700 border-transparent text-white"
            )}
            title="CSVファイルから回答データを一括追加・更新します"
          >
            <Upload size={13} />
            CSV一括インポート
          </button>
        </div>
      </div>

      {/* CSV Import Tray Section */}
      <AnimatePresence>
        {showCsvBox && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-blue-50/20 border-b border-[#E1E2E4]"
          >
            <div className="p-6">
              <div className="flex items-start gap-2.5 text-xs text-blue-800 mb-4 bg-blue-50 border border-blue-100 p-3 rounded-lg leading-relaxed">
                <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">💡 CSVインポートについてのヒント</p>
                  <p>・すでにある児童・生徒名と一致するデータは、CSV側の内容で上書き（更新）されます。</p>
                  <p>・面談形式に「Zoom」や「オンライン」が含まれる場合、自動的にZoom希望としてマークされます。</p>
                  <p>・既存の回答が無い生徒に、あらかじめ時間枠を制限せずに（NG時間なしで）名前だけ一括登録しておく用途にもご活用いただけます。</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl">
                {/* Right/Left: Explanation */}
                <div className="md:col-span-1 border border-gray-200 bg-white p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#1A1C1E] mb-2 flex items-center gap-1">
                      <FileSpreadsheet size={14} className="text-blue-600" />
                      1. テンプレートの用意
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                      インポート用の推奨フォーマットが記載されたCSVテンプレートを用意しています。まず、こちらをダウンロードして内容をご記入ください。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-300 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Download size={13} />
                    テンプレートをDL
                  </button>
                </div>

                {/* Drag and drop zone */}
                <div className="md:col-span-2">
                  <div
                    onDragOver={handleDragOverFile}
                    onDragLeave={handleDragLeaveFile}
                    onDrop={handleDropFile}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-full bg-white",
                      isDragOver
                        ? "border-blue-500 bg-blue-50/50 scale-[0.99] shadow-sm"
                        : "border-gray-300 hover:border-gray-400 hover:bg-gray-50/30"
                    )}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv"
                      className="hidden"
                    />
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                      <Upload size={18} />
                    </div>
                    <p className="text-xs font-bold text-gray-700 mb-1">
                      {isDragOver ? "ここにドロップしてアップロード" : "CSVファイルをドラッグ＆ドロップするか、クリックして選択"}
                    </p>
                    <p className="text-[10px] text-gray-400">対応：Excel、Googleスプレッドシート、テキストエディタ等で編集したCSV</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
  const [zoomGroupingPolicy, setZoomGroupingPolicy] = useState<'none' | 'one_place' | 'time_only'>('none');
  const [isGenerating, setIsGenerating] = useState(false);
  const [allClassesResponses, setAllClassesResponses] = useState<{ [classId: string]: ParentResponse[] }>({});
  const [allSchedules, setAllSchedules] = useState<{ [classId: string]: Schedule }>({});
  const [allClassesInfo, setAllClassesInfo] = useState<{ [classId: string]: ClassInfo }>({});
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'classes', classId, 'schedules', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSchedule(data as Schedule);
        setBreakInterval(data.settings?.breakInterval || 2);
        setZoomGroupingPolicy(data.settings?.zoomGroupingPolicy || 'none');
      }
    });
    return unsub;
  }, [classId]);

  // Fetch all responses and schedules across all classes to detect siblings
  useEffect(() => {
    const fetchAllData = async () => {
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classIds = classesSnap.docs.map(d => d.id).filter(id => !id.startsWith('settings_'));
      
      const infoMap: { [classId: string]: ClassInfo } = {};
      classesSnap.docs.forEach(d => {
        if (!d.id.startsWith('settings_')) {
          infoMap[d.id] = d.data() as ClassInfo;
        }
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

      // Sort availabilities by date, and their slots by start time
      availabilities.sort((a, b) => a.date.localeCompare(b.date));
      availabilities.forEach(a => {
        a.slots.sort((s1, s2) => s1.start.localeCompare(s2.start));
      });

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
      let consecutiveInterviews = 0;

      // Helper function to check if slotB directly follows slotA (allowing standard gaps up to 20 minutes)
      const isConsecutive = (slotA: ScheduleSlot, slotB: ScheduleSlot): boolean => {
        if (slotA.date !== slotB.date) return false;
        try {
          const [hA, mA] = slotA.end.split(':').map(Number);
          const [hB, mB] = slotB.start.split(':').map(Number);
          const tA = hA * 60 + mA;
          const tB = hB * 60 + mB;
          const diff = tB - tA;
          return diff >= 0 && diff <= 20;
        } catch (e) {
          return false;
        }
      };

      // Zoom grouping policy optimization:
      // If policy is 'one_place', find the single best day that can accommodate the most Zoom requests
      let zoomTargetDate = '';
      if (zoomGroupingPolicy === 'one_place') {
        const uniqueDates = Array.from(new Set(allAvailableSlots.map(s => s.date)));
        let maxZoomScore = -1;
        for (const date of uniqueDates) {
          const daySlots = allAvailableSlots.filter(s => s.date === date);
          const zoomResponses = unassignedStudents.filter(s => s.wantsZoom);
          let matchableCount = 0;
          zoomResponses.forEach(r => {
            const hasAvailableSlotInDay = daySlots.some(s => !r.unavailableSlots.some(ng => ng.date === s.date && ng.start === s.start));
            if (hasAvailableSlotInDay) {
              matchableCount++;
            }
          });
          if (matchableCount > maxZoomScore) {
            maxZoomScore = matchableCount;
            zoomTargetDate = date;
          }
        }
      }

      for (const slot of allAvailableSlots) {
        const lastSlot = resultSlots.length > 0 ? resultSlots[resultSlots.length - 1] : null;

        // Check if the current slot is consecutive from the last assigned interview slot
        const isCurrentlyConsecutive = lastSlot &&
          lastSlot.type === 'interview' &&
          lastSlot.studentName !== '' &&
          lastSlot.studentName !== '（空き）' &&
          lastSlot.studentName !== '（休憩）' &&
          isConsecutive(lastSlot, slot);

        if (!isCurrentlyConsecutive) {
          consecutiveInterviews = 0;
        }

        // If consecutive count reached interval, and the next slot is consecutive, force a break
        if (breakInterval > 0 && consecutiveInterviews >= breakInterval) {
          if (isCurrentlyConsecutive) {
            resultSlots.push({ ...slot, studentName: '（休憩）', type: 'break' });
            consecutiveInterviews = 0;
            continue;
          } else {
            consecutiveInterviews = 0;
          }
        }

        // Find a student who is NOT NG for this slot with Zoom preferences
        const candidates = unassignedStudents.filter(s => 
          !s.unavailableSlots.some(ng => ng.date === slot.date && ng.start === slot.start)
        );

        let studentIndex = -1;
        if (candidates.length > 0) {
          let preferredCandidates = [...candidates];

          if (zoomGroupingPolicy === 'one_place' && zoomTargetDate) {
            if (slot.date === zoomTargetDate) {
              const zoomCandidates = candidates.filter(s => s.wantsZoom);
              if (zoomCandidates.length > 0) {
                preferredCandidates = zoomCandidates;
              } else {
                preferredCandidates = candidates.filter(s => !s.wantsZoom);
              }
            } else {
              const nonZoomCandidates = candidates.filter(s => !s.wantsZoom);
              if (nonZoomCandidates.length > 0) {
                preferredCandidates = nonZoomCandidates;
              } else {
                preferredCandidates = candidates.filter(s => s.wantsZoom);
              }
            }
          } else if (zoomGroupingPolicy === 'time_only') {
            const daySlots = allAvailableSlots.filter(s => s.date === slot.date);
            const slotIndexInDay = daySlots.findIndex(s => s.start === slot.start);
            const totalSlotsInDay = daySlots.length;
            const isFirstHalf = slotIndexInDay < (totalSlotsInDay / 2);

            if (isFirstHalf) {
              const zoomCandidates = candidates.filter(s => s.wantsZoom);
              if (zoomCandidates.length > 0) {
                preferredCandidates = zoomCandidates;
              } else {
                preferredCandidates = candidates.filter(s => !s.wantsZoom);
              }
            } else {
              const nonZoomCandidates = candidates.filter(s => !s.wantsZoom);
              if (nonZoomCandidates.length > 0) {
                preferredCandidates = nonZoomCandidates;
              } else {
                preferredCandidates = candidates.filter(s => s.wantsZoom);
              }
            }
          }

          const chosenStudent = preferredCandidates[0];
          studentIndex = unassignedStudents.findIndex(s => s.studentName === chosenStudent.studentName);
        }

        if (studentIndex !== -1) {
          const student = unassignedStudents.splice(studentIndex, 1)[0];
          resultSlots.push({ ...slot, studentName: student.studentName, type: 'interview' });
          consecutiveInterviews++;
        } else {
          // No student available for this slot, leave it empty
          resultSlots.push({ ...slot, studentName: '（空き）', type: 'interview' });
          consecutiveInterviews = 0;
        }
      }

      // Add remaining students if any
      unassignedStudents.forEach(s => {
        resultSlots.push({ studentName: s.studentName, date: '', start: '', end: '', type: 'interview' });
      });

      await setDoc(doc(db, 'classes', classId, 'schedules', 'current'), {
        slots: resultSlots,
        settings: { breakInterval, zoomGroupingPolicy }
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

  const isSlotNGForStudent = (studentName: string, date: string, start: string) => {
    if (!studentName || studentName === '（休憩）' || studentName === '（空き）' || studentName === '') return false;
    const nameNoSpacing = studentName.replace(/\s+/g, '');
    const matched = allClassesResponses[classId]?.find(
      r => r.studentName.replace(/\s+/g, '') === nameNoSpacing
    );
    if (!matched) return false;
    return matched.unavailableSlots?.some(ng => ng.date === date && ng.start === start) || false;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggingIndex === null || !schedule) return;
    const draggedStudent = schedule.slots[draggingIndex].studentName;
    const targetSlot = schedule.slots[index];

    if (draggedStudent && draggedStudent !== '（休憩）' && draggedStudent !== '（空き）') {
      const isNG = isSlotNGForStudent(draggedStudent, targetSlot.date, targetSlot.start);
      if (isNG) {
        return;
      }
    }

    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggingIndex === null || draggingIndex === targetIndex || !schedule) {
      setDraggingIndex(null);
      return;
    }

    const draggedStudent = schedule.slots[draggingIndex].studentName;
    const targetSlot = schedule.slots[targetIndex];

    if (draggedStudent && draggedStudent !== '（休憩）' && draggedStudent !== '（空き）') {
      if (isSlotNGForStudent(draggedStudent, targetSlot.date, targetSlot.start)) {
        setDraggingIndex(null);
        return;
      }
    }

    const newSlots = [...schedule.slots];
    const temp = newSlots[draggingIndex].studentName;
    newSlots[draggingIndex].studentName = newSlots[targetIndex].studentName;
    newSlots[targetIndex].studentName = temp;

    setDraggingIndex(null);

    await updateDoc(doc(db, 'classes', classId, 'schedules', 'current'), {
      slots: newSlots
    });
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-[#E1E2E4] shadow-sm">
        <h3 className="font-bold mb-4">自動作成設定</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#44474E] mb-2">休憩を入れる間隔</label>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map(val => (
                <button
                  key={val}
                  type="button"
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
            <p className="text-xs text-gray-400 mt-1">※連続で指定した人数分の面談が入った後に1回休憩（空き枠）を追加します</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#44474E]">ZOOM希望者の配置方法</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { val: 'none' as const, label: '日も時間もばらばら（標準）', desc: '空いている枠から割り当て' },
                { val: 'one_place' as const, label: '1日1ヵ所にまとめる', desc: '特定の日1日にまとめて割り当て' },
                { val: 'time_only' as const, label: '複数日でも時間だけまとめる', desc: '各日の前半に寄せて割り当て' },
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setZoomGroupingPolicy(item.val)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-left flex flex-col justify-between min-h-[4.5rem] transition-all",
                    zoomGroupingPolicy === item.val
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white border-[#E1E2E4] text-[#44474E] hover:bg-[#F8F9FA]"
                  )}
                >
                  <span className="font-bold text-xs leading-snug">{item.label}</span>
                  <span className={cn(
                    "text-[10px] leading-tight block mt-1",
                    zoomGroupingPolicy === item.val ? "text-blue-100" : "text-gray-400"
                  )}>
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#F1F2F4] flex justify-end">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-xl font-bold">作成されたスケジュール</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-[#E1E2E4] print:hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    viewMode === 'matrix' 
                      ? "bg-white text-blue-600 shadow-xs" 
                      : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  <Calendar size={13} />
                  時間割表表示
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    viewMode === 'list' 
                      ? "bg-white text-blue-600 shadow-xs" 
                      : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  <FileText size={13} />
                  リスト表示
                </button>
              </div>
              <Link
                to={`/letter/${classId}`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E1E2E4] text-[#1A1C1E] rounded-lg font-medium hover:bg-[#F8F9FA] transition-colors text-sm shadow-xs"
              >
                <Printer size={18} />
                お知らせの手紙を表示
              </Link>
            </div>
          </div>

          {viewMode === 'matrix' ? (
            <div className="bg-white rounded-2xl border border-[#E1E2E4] shadow-sm overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border-spacing-0 text-left min-w-[700px]">
                  <thead className="bg-[#F8F9FA] text-sm font-medium text-[#44474E] border-b border-[#E1E2E4]">
                    <tr>
                      <th className="px-4 py-3 font-bold border-r border-[#E1E2E4] text-center sticky left-0 bg-[#F8F9FA] z-10 w-32 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                        時間帯
                      </th>
                      {(() => {
                        const activeSlots = schedule.slots.filter(s => s.date && s.start);
                        const uniqueDates = Array.from(new Set(activeSlots.map(s => s.date))).sort() as string[];
                        return uniqueDates.map(date => (
                          <th key={date} className="px-4 py-3 font-bold border-r border-[#E1E2E4] text-center min-w-[150px]">
                            {format(parse(date, 'yyyy-MM-dd', new Date()), 'M/d(E)', { locale: ja })}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E2E4]">
                    {(() => {
                      const activeSlots = schedule.slots.filter(s => s.date && s.start);
                      const uniqueDates = Array.from(new Set(activeSlots.map(s => s.date))).sort() as string[];
                      const uniqueTimeSlots = (Array.from(
                        new Set(activeSlots.map(s => JSON.stringify({ start: s.start, end: s.end })))
                      ) as string[]).map(str => JSON.parse(str) as { start: string; end: string })
                       .sort((a, b) => a.start.localeCompare(b.start));

                      return uniqueTimeSlots.map(timeSlot => (
                        <tr key={`${timeSlot.start}-${timeSlot.end}`} className="hover:bg-[#F8F9FA]/50 transition-colors">
                          <td className="px-4 py-4 text-sm font-bold border-r border-[#E1E2E4] bg-gray-50/50 text-center sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col justify-center items-center gap-0.5">
                              <Clock size={12} className="text-gray-400" />
                              <span className="text-[#1A1C1E] font-bold text-sm">{timeSlot.start}</span>
                              <span className="text-[10px] text-gray-400 font-normal">~ {timeSlot.end}</span>
                            </div>
                          </td>
                          {uniqueDates.map(date => {
                            const slotIdx = schedule.slots.findIndex(s => s.date === date && s.start === timeSlot.start && s.end === timeSlot.end);
                            if (slotIdx === -1) {
                              return (
                                <td 
                                  key={date} 
                                  className="p-1 border-r border-[#E1E2E4] bg-gray-50/30 text-center text-gray-300 italic text-xs select-none"
                                  style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, #f9fafb, #f9fafb 4px, #f3f4f6 4px, #f3f4f6 8px)'
                                  }}
                                >
                                  -
                                </td>
                              );
                            }

                            const slot = schedule.slots[slotIdx];
                            const siblings = getSiblingInfo(slot.studentName, classId);
                            const draggedStudent = draggingIndex !== null ? schedule.slots[draggingIndex].studentName : '';
                            const isDraggingActive = draggingIndex !== null;
                            const isDraggingThis = draggingIndex === slotIdx;
                            const isDragOverThis = dragOverIndex === slotIdx;
                            const isNGForDragged = draggedStudent ? isSlotNGForStudent(draggedStudent, slot.date, slot.start) : false;

                            return (
                              <td
                                key={date}
                                onDragOver={(e) => handleDragOver(e, slotIdx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, slotIdx)}
                                className={cn(
                                  "p-3 border-r border-[#E1E2E4] text-xs transition-all relative min-h-[90px] w-40",
                                  slot.type === 'break' && "bg-gray-50 italic text-gray-500",
                                  // Active drag styles
                                  isDraggingActive && isDraggingThis && "bg-blue-50/60 opacity-50 border-2 border-dashed border-blue-400 scale-[0.98]",
                                  isDraggingActive && !isDraggingThis && isNGForDragged && "bg-red-50/20 opacity-40 grayscale pointer-events-none select-none hover:bg-red-50/20",
                                  isDraggingActive && !isDraggingThis && !isNGForDragged && isDragOverThis && "bg-green-100/75 border-y-2 border-dashed border-green-500 scale-[0.99] shadow-sm",
                                  isDraggingActive && !isDraggingThis && !isNGForDragged && !isDragOverThis && "bg-green-50/10 border-dashed border-green-200 cursor-copy hover:bg-green-100/30"
                                )}
                              >
                                <div className="space-y-1.5 h-full flex flex-col justify-between">
                                  <div
                                    draggable={!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）'}
                                    onDragStart={(e) => handleDragStart(e, slotIdx)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                      "flex items-center justify-between gap-1 p-1.5 rounded-lg border shadow-xs transition-all select-none max-w-full font-bold text-xs",
                                      slot.studentName === '（休憩）' || slot.studentName === '（空き）' || !slot.studentName
                                        ? "bg-gray-100 border-gray-200 text-gray-400 cursor-default hover:bg-gray-200"
                                        : getStudentZoomRequest(slot.studentName)
                                          ? "bg-blue-50 border-blue-200 text-blue-950 cursor-grab active:cursor-grabbing hover:bg-blue-100"
                                          : "bg-white border-blue-100 text-blue-950 cursor-grab active:cursor-grabbing hover:bg-blue-50"
                                    )}
                                    title={!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）' ? "ドラッグして他の時間帯の枠と入れ替えられます" : undefined}
                                  >
                                    <span className="truncate max-w-[100px] pointer-events-none">{slot.studentName || '（空き）'}</span>
                                    {!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）' && (
                                      <GripVertical size={11} className="text-gray-400 flex-shrink-0 pointer-events-none" />
                                    )}
                                  </div>

                                  <input
                                    type="text"
                                    value={slot.studentName}
                                    onChange={(e) => updateSlot(slotIdx, e.target.value)}
                                    className="bg-transparent border-b border-transparent focus:border-blue-400 focus:ring-0 text-[11px] text-[#44474E] hover:text-gray-600 focus:text-gray-900 transition-all w-full px-1 py-0.5"
                                    placeholder="直接編集..."
                                  />

                                  {getStudentZoomRequest(slot.studentName) && (
                                    <div className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1 py-0.5 rounded-md select-none text-center truncate" title="Zoom希望">
                                      💻 Zoom希望
                                    </div>
                                  )}

                                  {siblings && siblings.map((sib, sIdx) => {
                                    const isDifferentDay = sib.date && sib.date !== slot.date;
                                    return (
                                      <div key={sIdx} className="text-[9px] leading-tight text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 truncate" title={`兄弟: ${sib.studentName} (${sib.className})`}>
                                        兄弟: {sib.studentName}
                                        {isDifferentDay && <span className="ml-0.5 text-red-650 font-normal">[別日]</span>}
                                      </div>
                                    );
                                  })}

                                  {isDraggingActive && !isDraggingThis && (
                                    <div className="pt-0.5">
                                      {isNGForDragged ? (
                                        <span className="text-[8px] font-bold text-red-500 bg-red-50 border border-red-100 px-1 py-0.5 rounded block text-center">
                                          ✕ NG
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-bold text-green-650 bg-green-50 border border-green-100 px-1 py-0.5 rounded block text-center">
                                          ✓ 配置可
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
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
                    const draggedStudent = draggingIndex !== null ? schedule.slots[draggingIndex].studentName : '';
                    const isDraggingActive = draggingIndex !== null;
                    const isDraggingThis = draggingIndex === i;
                    const isDragOverThis = dragOverIndex === i;
                    const isNGForDragged = draggedStudent ? isSlotNGForStudent(draggedStudent, slot.date, slot.start) : false;

                    return (
                      <tr 
                        key={i} 
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, i)}
                        className={cn(
                          "transition-all duration-150 border-b border-[#E1E2E4]",
                          slot.type === 'break' && "bg-gray-50 italic text-gray-500",
                          // Active drag styles
                          isDraggingActive && isDraggingThis && "bg-blue-50/60 opacity-50 border-2 border-dashed border-blue-400 scale-[0.98]",
                          isDraggingActive && !isDraggingThis && isNGForDragged && "bg-red-50/20 opacity-40 grayscale pointer-events-none select-none hover:bg-red-50/20",
                          isDraggingActive && !isDraggingThis && !isNGForDragged && isDragOverThis && "bg-green-100/75 border-y-2 border-dashed border-green-500 scale-[0.99] shadow-sm",
                          isDraggingActive && !isDraggingThis && !isNGForDragged && !isDragOverThis && "bg-green-50/10 border-dashed border-green-200 cursor-copy hover:bg-green-100/30"
                        )}
                      >
                        <td className="px-6 py-4 text-sm font-medium">
                          {slot.date ? format(parse(slot.date, 'yyyy-MM-dd', new Date()), 'M/d(E)', { locale: ja }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {slot.start ? `${slot.start} - ${slot.end}` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 py-0.5">
                            {/* Drag handle block */}
                            <div
                              draggable={!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）'}
                              onDragStart={(e) => handleDragStart(e, i)}
                              onDragEnd={handleDragEnd}
                              className={cn(
                                "flex items-center gap-1.5 p-1 px-2.5 rounded-lg border shadow-xs transition-all select-none max-w-full font-bold text-sm",
                                slot.studentName === '（休憩）' || slot.studentName === '（空き）' || !slot.studentName
                                  ? "bg-gray-100 border-gray-200 text-gray-500 cursor-default hover:bg-gray-200"
                                  : getStudentZoomRequest(slot.studentName)
                                    ? "bg-blue-50 border-blue-200 text-blue-900 cursor-grab active:cursor-grabbing hover:bg-blue-100"
                                    : "bg-white border-blue-100 text-blue-950 cursor-grab active:cursor-grabbing hover:bg-blue-50"
                              )}
                              title={!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）' ? "ドラッグして他の時間帯の枠と入れ替えられます" : undefined}
                            >
                              {!!slot.studentName && slot.studentName !== '（空き）' && slot.studentName !== '（休憩）' && (
                                <GripVertical size={13} className="text-gray-400 flex-shrink-0 pointer-events-none" />
                              )}
                              <span className="truncate max-w-[150px] pointer-events-none">{slot.studentName || '（空き）'}</span>
                            </div>

                            {/* Quick manual text correction field */}
                            <input
                              type="text"
                              value={slot.studentName}
                              onChange={(e) => updateSlot(i, e.target.value)}
                              className="bg-transparent border-b border-transparent focus:border-blue-400 focus:ring-0 text-xs text-gray-400 hover:text-gray-600 focus:text-gray-900 transition-all w-24 px-1 py-0.5 ml-1"
                              placeholder="直接編集..."
                              title="クリックして名前を直接書き換えることもできます"
                            />

                            {getStudentZoomRequest(slot.studentName) && (
                              <span className="flex-shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full select-none animate-pulse" title="Zoom面談を希望しています">
                                💻 Zoom希望
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
                          {isDraggingActive && !isDraggingThis ? (
                            isNGForDragged ? (
                              <span className="text-[10px] md:text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1 w-fit select-none">
                                ✕ NG時間帯 (配置不可)
                              </span>
                            ) : (
                              <span className="text-[10px] md:text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1 w-fit animate-bounce">
                                ✓ 配置可能 (ドロップ可)
                              </span>
                            )
                          ) : (
                            slot.studentName === '' && <span className="text-xs text-red-500 font-bold">未配置</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Unassigned Students Section */}
          {(() => {
            const unassignedItemIndices = schedule.slots
              .map((s, idx) => ({ slot: s, index: idx }))
              .filter(item => !item.slot.date || !item.slot.start);

            if (unassignedItemIndices.length === 0) return null;

            return (
              <div className="p-5 border-2 border-dashed border-amber-200 bg-amber-50/40 rounded-2xl">
                <h4 className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600" />
                  未配置の児童・生徒（{unassignedItemIndices.length}人）
                </h4>
                <p className="text-xs text-amber-700 mt-1 mb-4">
                  自動スケジューラ調整で、時間枠またはご都合の合う枠が不足していたため配置されなかった児童です。
                  空いている枠（空き枠）へ<b>ドラッグ＆ドロップして配置・入れ替え</b>が可能です。
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {unassignedItemIndices.map(({ slot, index }) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-200 text-amber-900 rounded-lg shadow-xs hover:shadow-sm cursor-grab active:cursor-grabbing font-bold text-xs select-none"
                    >
                      <GripVertical size={12} className="text-amber-400 pointer-events-none" />
                      <span className="pointer-events-none">{slot.studentName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

const ParentForm = () => {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([]);
  const [studentName, setStudentName] = useState(() => {
    return safeStorage.getItem(`draft_student_name_${classId}`) || '';
  });
  const [guardianPhone, setGuardianPhone] = useState('');
  const [ngSlots, setNgSlots] = useState<{ date: string; start: string; end: string }[]>([]);
  const [talkTopics, setTalkTopics] = useState('');
  const [alternativeSchedule, setAlternativeSchedule] = useState('');
  const [wantsZoom, setWantsZoom] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classId) {
      safeStorage.setItem(`draft_student_name_${classId}`, studentName);
    }
  }, [studentName, classId]);

  useEffect(() => {
    if (!classId) {
      setError("面談URLが無効です（クラスIDがありません）。URLを再度ご確認ください。");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const docRef = doc(db, 'classes', classId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("指定されたクラス（面談URL）が見て取れません。担任の先生から送られたURLが正しいか、またはすでにクラスが削除されていないかご確認ください。");
          setIsLoading(false);
          return;
        }

        const info = { id: docSnap.id, ...docSnap.data() } as ClassInfo;
        setClassInfo(info);

        const q = collection(db, 'classes', classId, 'teacherAvailability');
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => doc.data() as TeacherAvailability);
        setAvailabilities(list.sort((a, b) => a.date.localeCompare(b.date)));

        setIsLoading(false);
      } catch (err: any) {
        console.error("Firestore loading error inside ParentForm:", err);
        setError(`データの読み込み中にエラーが発生しました。\nネットワーク接続を確認するか、しばらく経ってから再度お試しください。\n（開発者向けエラー情報: ${err?.message || err}）`);
        setIsLoading(false);
      }
    };

    loadData();
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
    safeStorage.removeItem(`draft_student_name_${classId}`);
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

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="text-[#1A1C1E] font-medium text-lg">面談調整アンケートを読み込み中...</div>
        <p className="text-sm text-gray-500">データを取得しています。しばらくお待ちください。</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 md:p-8 text-center shadow-xs">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-red-900 mb-3">読み込みエラー</h2>
          <p className="text-red-700 text-sm whitespace-pre-wrap leading-relaxed text-left max-w-sm mx-auto mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
          >
            ページを再読み込みする
          </button>
        </div>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <p className="text-gray-500">学級データが見つかりません。</p>
      </div>
    );
  }

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
  const [messageText, setMessageText] = useState("");
  const [isCopied, setIsCopied] = useState(false);

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

  useEffect(() => {
    if (!classInfo) return;

    const datesText = availabilities.length > 0 
      ? availabilities.map(avail => {
          const formattedDate = format(parse(avail.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja });
          const start = avail.slots[0]?.start || '';
          const end = avail.slots[avail.slots.length - 1]?.end || '';
          return `・${formattedDate} ${start} ～ ${end}`;
        }).join('\n')
      : '・（面談日時が未登録です。管理画面からご設定ください）';

    const deadlineText = classInfo.deadline 
      ? format(parse(classInfo.deadline, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja })
      : '（未設定）';

    const parentUrl = `${window.location.origin}/#/parent/${classId}`;

    const text = `【${classInfo.name}】個人面談の実施について

いつも学校の教育活動にご理解とご協力をいただき、誠にありがとうございます。

下記の日程にて本クラスの個人面談を実施いたします。
つきましては、日程調整のため、お手数ですが期限までに
以下のURLより「面談が不可能な日時（ご都合の悪い時間帯）」をご回答ください。


1. 実施日時
${datesText}

2. 回答方法（回答用URL）
以下のURLへ直接アクセスし、期日までに回答アンケートにご回答ください。
${parentUrl}

3. 回答期限
${deadlineText}まで

※日程確定後は、決定スケジュールを別途お知らせいたします。
※希望変更が生じた場合は、回答期限内であればもう一度送信してください。最新の回答が有効となります。回答期限を過ぎてしまった場合は、お手数ですが連絡帳等にてその旨をお知らせください。`;

    setMessageText(text);
  }, [classInfo, availabilities, classId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (!classInfo) return <div className="text-center py-20">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 print:p-0">
      {window.location.origin.includes('-dev-') && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium print:hidden shadow-xs">
          ⚠️ 現在「開発用URL」でメッセージを作成しています。このまま配布すると保護者の端末でエラー（403）が表示されます。
          <br />
          右上の「共有」ボタンから発行される「公開用URL（-pre-で始まるURL）」の管理画面からURLを発行・コピーしてください。
        </div>
      )}

      {/* 案内ヘッダー */}
      <div className="mb-6 p-5 bg-blue-50/70 border border-blue-200 rounded-xl text-sm text-blue-900 print:hidden shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">📢</span>
          <div className="space-y-1">
            <h3 className="font-bold">配信用お便りテキスト作成</h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              PDFや印刷の制約をなくし、そのまま連絡システムやメール、LINEへペースト（貼り付け）できるコピペ専用ボードへとリニューアルしました！<br />
              以下の入力枠内の日本語テキストは、<b>キーボードで、いつでも自由に追記・変更</b>できます。調整完了後、お好きな箇所の「文章をコピーする」ボタンを押すと、一発でクリップボードへ保存されます。
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => navigate(`/teacher/class/${classId}`)}
          className="flex items-center gap-2 px-4 py-2 text-[#44474E] hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
        >
          <ChevronRight size={18} className="rotate-180" />
          クラス管理画面に戻る
        </button>

        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:shadow-md active:scale-95 ${
            isCopied 
              ? "bg-green-600 hover:bg-green-700 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white animate-pulse"
          }`}
        >
          {isCopied ? (
            <>
              <Check size={18} />
              コピー完了！
            </>
          ) : (
            <>
              <Copy size={18} />
              文章をコピーする
            </>
          )}
        </button>
      </div>

      {/* 本文エリア */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <span className="text-xs font-bold text-gray-400 tracking-wider">PREVIEW & EDIT</span>
          {isCopied && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full animate-fade-in">
              配布メッセージを保存しました
            </span>
          )}
        </div>

        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          className="w-full h-[600px] p-6 bg-gray-50/50 hover:bg-gray-50 focus:bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl focus:ring-4 focus:ring-blue-100 focus:outline-none text-gray-800 text-[14px] leading-relaxed font-sans transition-all resize-y shadow-inner-sm"
          placeholder="ここに入力・編集されたメッセージがコピーされます。"
        />

        <div className="mt-6 flex justify-end gap-3 print:hidden">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 w-full md:w-auto justify-center ${
              isCopied 
                ? "bg-green-600 hover:bg-green-700 text-white ring-4 ring-green-100" 
                : "bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-100"
            }`}
          >
            {isCopied ? (
              <>
                <Check size={18} />
                コピーに成功しました！このまま配信できます
              </>
            ) : (
              <>
                <Copy size={18} />
                この編集内容で文章をコピーする
              </>
            )}
          </button>
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
  const [messageText, setMessageText] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!classId) return;
    getDoc(doc(db, 'classes', classId)).then(docSnap => {
      if (docSnap.exists()) setClassInfo({ id: docSnap.id, ...docSnap.data() } as ClassInfo);
    });
    getDoc(doc(db, 'classes', classId, 'schedules', 'current')).then(docSnap => {
      if (docSnap.exists()) setSchedule(docSnap.data() as Schedule);
    });
  }, [classId]);

  useEffect(() => {
    if (!classInfo || !schedule) return;

    const sortedSlots = [...schedule.slots]
      .filter(s => s.type === 'interview' && s.studentName && !s.studentName.includes('（'))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start.localeCompare(b.start);
      });

    const slotsText = sortedSlots.length > 0 
      ? sortedSlots.map(slot => {
          const formattedDate = format(parse(slot.date, 'yyyy-MM-dd', new Date()), 'M月d日(E)', { locale: ja });
          return `・${formattedDate} ${slot.start} ～ ${slot.end} ： ${slot.studentName} 様`;
        }).join('\n')
      : '・（決定された面談枠がありません。スケジュールを自動作成してください）';

    const text = `【${classInfo.name}】個人面談日程決定のお知らせ

いつも学校の教育活動にご理解とご協力をいただき、誠にありがとうございます。

先日、アンケートにて調整いたしました、個人面談の日程が以下のように決定いたしましたのでお知らせいたします。
当日はお気をつけて、決定されました時間にお越しくださいますようお願い申し上げます。


1. 決定した面談日程一覧
${slotsText}

2. 面談場所
各教室

※ご都合が悪くなった場合や急な変更等が生じた場合は、お早めに担任までご連絡ください。`;

    setMessageText(text);
  }, [classInfo, schedule]);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (!classInfo || !schedule) return <div className="text-center py-20">読み込み中...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 print:p-0">
      {window.location.origin.includes('-dev-') && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium print:hidden shadow-xs">
          ⚠️ 現在「開発用URL」でメッセージを作成しています。このまま配布すると保護者の端末でエラー（403）が表示されます。
          <br />
          右上の「共有」ボタンから発行される「公開用URL（-pre-で始まるURL）」の管理画面からURLを発行・コピーしてください。
        </div>
      )}

      {/* 案内ヘッダー */}
      <div className="mb-6 p-5 bg-blue-50/70 border border-blue-200 rounded-xl text-sm text-blue-900 print:hidden shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">📢</span>
          <div className="space-y-1">
            <h3 className="font-bold">配信用決定お便りテキスト作成</h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              PDFや印刷の制約をなくし、そのまま連絡システムやメール、LINEへペースト（貼り付け）できるコピペ専用ボードへとリニューアルしました！<br />
              以下の入力枠内の日本語テキストは、<b>キーボードで、いつでも自由に追記・変更</b>できます。調整完了後、お好きな箇所の「文章をコピーする」ボタンを押すと、一発でクリップボードへ保存されます。
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => navigate(`/teacher/class/${classId}`)}
          className="flex items-center gap-2 px-4 py-2 text-[#44474E] hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
        >
          <ChevronRight size={18} className="rotate-180" />
          クラス管理画面に戻る
        </button>

        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:shadow-md active:scale-95 ${
            isCopied 
              ? "bg-green-600 hover:bg-green-700 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white animate-pulse"
          }`}
        >
          {isCopied ? (
            <>
              <Check size={18} />
              コピー完了！
            </>
          ) : (
            <>
              <Copy size={18} />
              文章をコピーする
            </>
          )}
        </button>
      </div>

      {/* 本文エリア */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 md:p-8">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <span className="text-xs font-bold text-gray-400 tracking-wider">PREVIEW & EDIT</span>
          {isCopied && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full animate-fade-in">
              配布メッセージを保存しました
            </span>
          )}
        </div>

        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          className="w-full h-[600px] p-6 bg-gray-50/50 hover:bg-gray-50 focus:bg-white border-2 border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl focus:ring-4 focus:ring-blue-100 focus:outline-none text-gray-800 text-[14px] leading-relaxed font-sans transition-all resize-y shadow-inner-sm"
          placeholder="ここに入力・編集されたメッセージがコピーされます。"
        />

        <div className="mt-6 flex justify-end gap-3 print:hidden">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 w-full md:w-auto justify-center ${
              isCopied 
                ? "bg-green-600 hover:bg-green-700 text-white ring-4 ring-green-100" 
                : "bg-blue-600 hover:bg-blue-700 text-white ring-4 ring-blue-100"
            }`}
          >
            {isCopied ? (
              <>
                <Check size={18} />
                コピーに成功しました！このまま配信できます
              </>
            ) : (
              <>
                <Copy size={18} />
                この編集内容で文章をコピーする
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SyncDevice = () => {
  const { teacherId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (teacherId) {
      safeStorage.setItem('teacher_id', teacherId);
    }
    navigate('/');
  }, [teacherId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-blue-100 p-8 shadow-sm max-w-md mx-auto my-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4 animate-bounce"></div>
      <p className="text-gray-800 font-bold text-sm mb-1">データを同期しています</p>
      <p className="text-xs text-gray-500 text-center">少々お待ちください。完了後、自動的にダッシュボードへ戻ります。</p>
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
          <Route path="/sync/:teacherId" element={<SyncDevice />} />
        </Routes>
      </Layout>
    </Router>
  );
}
