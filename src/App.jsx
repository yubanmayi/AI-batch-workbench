import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Settings, Download, Trash2, Video, Loader2, Sparkles, X, History, Wifi, WifiOff, AlertTriangle, Link as LinkIcon, Edit3, MessageSquare, Image as ImageIcon, UploadCloud, PlayCircle, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Info, Palette, Plus, XCircle, Shuffle, Zap, Monitor, Smartphone, Layers, Flame, Ratio, Bug, FileJson, Save, FolderOpen, Move, Server, RotateCw, Radio, ChevronDown, Terminal, Activity, Clock } from 'lucide-react';

// --- 閺嶅嘲绱℃稉搴″З閻?---
const APP_NAME = "麻衣的批量工作台";

// --- IndexedDB 閺佺増宓佹惔鎾充紣閸忓嘲鍤遍弫?---
const DB_NAME = 'MaiVideoDB';
const STORE_NAME = 'history';
const DB_VERSION = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

const dbAddItem = async (item) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

const dbGetAllItems = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (event) => {
            const result = event.target.result;
            result.sort((a, b) => b.id - a.id);
            resolve(result);
        };
        request.onerror = (event) => reject(event.target.error);
    });
};

const dbDeleteItem = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

const dbClearStore = async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
};

// 鏉堝懎濮崙鑺ユ殶閿涙艾娆㈡潻鐔虹搼瀵?
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const IMAGE_EXT_RE = /\.(jpeg|jpg|png|webp|gif|bmp)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm|avi|mkv)$/i;
const VIDEO_MODEL_HINTS = ['video', 'kling', 'vidu', 'jimeng', 'sora', 'runway', 'veo', 'wan', 'pika', 'hailuo', 'doubao'];
const IMAGE_MODEL_HINTS = ['image', 'img', 'dall', 'flux', 'stable', 'sd', 'recraft', 'ideogram', 'midjourney', 'gpt-image', 'mj'];

const createDefaultSlots = () => Array(10).fill(null).map((_, i) => ({
    id: i,
    images: [],
    prompt: '',
    videoUrl: null,
    mediaType: 'video',
    aspectRatio: '1:1',
    status: 'idle',
    errorMsg: '',
    isWebPage: false,
    isDragOver: false,
    streamContent: '',
    logs: []
}));

const normalizeBaseUrl = (rawUrl = '') => {
    let cleanUrl = rawUrl.trim().replace(/\/+$/, '');
    if (cleanUrl.endsWith('/v1')) cleanUrl = cleanUrl.slice(0, -3);
    return cleanUrl;
};

const normalizeModelText = (model) => {
    if (!model) return '';
    if (typeof model === 'string') return model.toLowerCase();
    return [model.id, model.name, model.owned_by, model.type, model.description].filter(Boolean).join(' ').toLowerCase();
};

const splitModelsByMedia = (models = []) => {
    if (!Array.isArray(models) || models.length === 0) return { image: [], video: [] };
    const image = [];
    const video = [];
    models.forEach((m) => {
        const text = normalizeModelText(m);
        const hitImage = IMAGE_MODEL_HINTS.some(h => text.includes(h));
        const hitVideo = VIDEO_MODEL_HINTS.some(h => text.includes(h));
        if (hitImage || (!hitImage && !hitVideo)) image.push(m);
        if (hitVideo || (!hitImage && !hitVideo)) video.push(m);
    });
    return {
        image: image.length > 0 ? image : models,
        video: video.length > 0 ? video : models,
    };
};

const isImageUrl = (url = '') => typeof url === 'string' && (url.startsWith('data:image') || IMAGE_EXT_RE.test(url));
const isVideoUrl = (url = '') => typeof url === 'string' && VIDEO_EXT_RE.test(url);

const safeStringify = (value) => {
    try {
        return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
        return String(value ?? '');
    }
};

const collectUrls = (value, urls = []) => {
    if (!value) return urls;
    if (typeof value === 'string') {
        if (value.startsWith('http') || value.startsWith('data:image')) urls.push(value);
        return urls;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectUrls(item, urls));
        return urls;
    }
    if (typeof value === 'object') {
        Object.keys(value).forEach((k) => {
            if (k.toLowerCase().includes('url') && typeof value[k] === 'string') urls.push(value[k]);
            collectUrls(value[k], urls);
        });
    }
    return urls;
};

const pickMediaUrlFromPayload = (payload, preferredType = 'image') => {
    const candidates = collectUrls(payload, []);
    if (candidates.length === 0) return '';
    const picker = preferredType === 'video' ? isVideoUrl : isImageUrl;
    return candidates.find(picker) || candidates[0] || '';
};

const getJsonPath = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);

const pickTaskIdFromPayload = (payload) => {
    const keys = ['id', 'task_id', 'taskId', 'video_id', 'videoId', 'data.id'];
    for (const key of keys) {
        const value = getJsonPath(payload || {}, key);
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const pickTaskStatusFromPayload = (payload) => {
    const keys = ['status', 'state', 'task_status', 'data.status', 'data.state'];
    for (const key of keys) {
        const value = getJsonPath(payload || {}, key);
        if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
    }
    return '';
};

const VIDEO_SIZE_BY_AR = {
    '1:1': '1024x1024',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '4:3': '1024x768',
    '3:4': '768x1024',
    '3:2': '1152x768',
    '2:3': '768x1152',
    '5:4': '1280x1024',
    '4:5': '1024x1280',
    '21:9': '1536x640',
};

const resolveVideoSize = (aspectRatio = '1:1') => VIDEO_SIZE_BY_AR[aspectRatio] || VIDEO_SIZE_BY_AR['1:1'];

const extractImageUrlFromPayload = (payload) => {
    const first = payload?.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    return pickMediaUrlFromPayload(payload, 'image');
};

const normalizeTaskStatus = (status = '') => {
    const s = String(status || '').toLowerCase();
    if (!s) return '';
    if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(s)) return 'completed';
    if (['failed', 'error', 'cancelled', 'canceled'].includes(s)) return 'failed';
    if (['queued', 'pending', 'in_progress', 'processing', 'running'].includes(s)) return 'in_progress';
    return s;
};

// --- 鏍稿績鍗囩骇锛氬畨鍏ㄤ笅杞藉櫒 ---
const handleDownloadSecure = async (url, filename) => {
    try {
        let downloadUrl = url;
        
        if (url.startsWith('http')) {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                downloadUrl = URL.createObjectURL(blob);
            } catch (e) {
                console.warn("Fetch failed, falling back to direct link", e);
                window.open(url, '_blank');
                return;
            }
        }
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename || `maivideo_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(downloadUrl);
        }
    } catch (error) {
        console.error("Download failed:", error);
        alert("下载失败，请尝试右键另存。");
    }
};

// --- 閸楀洨楠囬悧鍫㈢矒缁旑垱妫╄箛妤冪矋娴?---
const TerminalConsole = ({ logs = [] }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogStyle = (text, type) => {
        const lower = String(text || '').toLowerCase();
        if (type === 'error' || lower.includes('error') || lower.includes('failed') || lower.includes('失败')) {
            return { icon: <XCircle className="w-3 h-3" />, color: 'text-red-400' };
        }
        if (type === 'warning' || lower.includes('warning') || lower.includes('recaptcha') || lower.includes('重试')) {
            return { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400' };
        }
        if (type === 'success' || lower.includes('success') || lower.includes('done') || lower.includes('完成') || lower.includes('成功')) {
            return { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400' };
        }
        if (lower.includes('start') || lower.includes('connecting') || lower.includes('启动') || lower.includes('开始')) {
            return { icon: <Zap className="w-3 h-3" />, color: 'text-blue-400' };
        }
        return { icon: <Activity className="w-3 h-3" />, color: 'text-slate-400' };
    };

    return (
        <div className="w-full h-full bg-[#09090b] flex flex-col font-mono text-[11px] overflow-hidden rounded-lg border border-slate-800 relative group shadow-inner">
            <div className="h-7 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-3 sticky top-0 z-10">
                <span className="text-slate-400 flex items-center gap-1.5 font-bold"><Terminal className="w-3 h-3 text-purple-500" /> 任务日志</span>
                <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 opacity-50">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>等待任务启动...</span>
                    </div>
                )}
                {logs.map((log, index) => {
                    const style = getLogStyle(log.text, log.type);
                    return (
                        <div key={index} className={`flex gap-2 items-start animate-in fade-in slide-in-from-left-1 duration-300`}>
                            <span className="text-slate-600 shrink-0 font-light text-[9px] pt-0.5">{log.time}</span>
                            <div className={`flex items-start gap-1.5 ${style.color} break-all`}>
                                <span className="mt-0.5 opacity-80">{style.icon}</span>
                                <span className="leading-relaxed">{log.text}</span>
                            </div>
                        </div>
                    );
                })}
                <div className="h-2"></div>
            </div>
        </div>
    );
};


export default function App() {
  const [apiKey, setApiKey] = useState('mayi666');
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000'); 
  const [concurrency, setConcurrency] = useState(3);
  const [enableStream, setEnableStream] = useState(true); 
  const [videoMode, setVideoMode] = useState('async');
  
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState({ image: '', video: '' });
  const [createMode, setCreateMode] = useState('image');
  const [slotsByMode, setSlotsByMode] = useState(() => ({
      image: createDefaultSlots(),
      video: createDefaultSlots(),
  }));
  
  const [prompt, setPrompt] = useState(''); 
  const [generationMode, setGenerationMode] = useState('text'); 

  const modelGroups = useMemo(() => splitModelsByMedia(availableModels), [availableModels]);
  const currentModeModels = createMode === 'video' ? modelGroups.video : modelGroups.image;
  const selectedModel = selectedModels[createMode] || '';
  const batchSlots = slotsByMode[createMode] || [];

  const updateSlots = useCallback((mode, updater) => {
      setSlotsByMode(prev => ({ ...prev, [mode]: updater(prev[mode] || []) }));
  }, []);

  const [isGenerating, setIsGenerating] = useState(false); 
  const [generatedVideos, setGeneratedVideos] = useState([]); 
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('create'); 
  const [statusMsg, setStatusMsg] = useState(''); 
  const [logs, setLogs] = useState([]); 
  
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(Date.now());
  const [galleryCategory, setGalleryCategory] = useState('setu'); 
  const fileInputRef = useRef(null); 

  const [lightboxImage, setLightboxImage] = useState(null);

  const galleryCategories = [
      { id: 'all', name: '随机推荐', icon: <Shuffle className="w-4 h-4" /> },
      { id: 'setu', name: '涩图专区', icon: <Zap className="w-4 h-4" /> },
      { id: 'r18', name: 'R18', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> }, 
      { id: 'mp', name: '手机壁纸', icon: <Smartphone className="w-4 h-4" /> },
  ];

  const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9"];

  const [modalState, setModalState] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const showAlert = (message, title = "提示") => setModalState({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (message, onConfirm, title = "确认操作") => setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));
  const handleModalConfirm = () => { if (modalState.onConfirm) modalState.onConfirm(); closeModal(); };

  const addLog = (msg) => {
      console.log(msg);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const addSlotLog = (slotId, text, type = 'info', mode = createMode) => {
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      updateSlots(mode, prev => prev.map(s => {
          if (s.id === slotId) {
              const lastLog = s.logs[s.logs.length - 1];
              if (lastLog && lastLog.text === text) return s;
              return { ...s, logs: [...s.logs, { time, text, type }] };
          }
          return s;
      }));
  };

  const saveVideoToHistory = async (videoData) => {
    try {
        setGeneratedVideos(prev => [videoData, ...prev]);
        await dbAddItem(videoData);
        addLog(`已保存到数据库: ${videoData.id}`);
    } catch (e) {
        addLog(`保存失败: ${e.message}`);
        showAlert("保存失败，可能是数据库错误。\n" + e.message, "错误");
    }
  };

  const handleDeleteItem = (id) => {
      showConfirm("确定要永久删除这条记录吗？\n删除后无法恢复。", async () => {
          try {
              await dbDeleteItem(id);
              setGeneratedVideos(prev => prev.filter(item => item.id !== id));
              addLog(`已删除记录: ${id}`);
          } catch (e) {
              showAlert("删除失败: " + e.message);
          }
      });
  };

  const handleExportHistory = async () => {
      try {
          const allItems = await dbGetAllItems();
          if (allItems.length === 0) {
              showAlert("还没有历史记录可以导出哦");
              return;
          }
          const blob = new Blob([JSON.stringify(allItems)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `maivideo_backup_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showAlert("备份文件已生成，请在下载弹窗中选择保存位置。", "导出成功");
      } catch (e) {
          showAlert("导出失败: " + e.message);
      }
  };

  const handleImportHistory = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const items = JSON.parse(e.target.result);
              if (!Array.isArray(items)) throw new Error("文件格式不正确");
              
              let count = 0;
              for (const item of items) {
                  if (item.id && item.url) {
                      await dbAddItem(item);
                      count++;
                  }
              }
              
              const newItems = await dbGetAllItems();
              setGeneratedVideos(newItems);
              showAlert(`成功恢复了 ${count} 条记录`, "导入成功");
          } catch (err) {
              showAlert("无法读取该文件，请确认是有效的备份文件。\n" + err.message, "导入失败");
          }
      };
      reader.readAsText(file);
      event.target.value = ''; 
  };

  // --- 娣囶喖顦查悙鐧哥窗缁夊娅庢禍?[selectedModel] 娓氭繆绂嗛敍宀勬Щ濮濄垹鎯婇悳顖炲櫢缂?---
    const fetchModels = useCallback(async (currentBaseUrl, currentApiKey) => {
      const cleanUrl = normalizeBaseUrl(currentBaseUrl);
      if (!cleanUrl) return;

      try {
          setStatusMsg("正在获取模型列表...");
          const res = await fetch(`${cleanUrl}/v1/models`, {
              headers: { Authorization: `Bearer ${currentApiKey}` }
          });
          if (!res.ok) {
              const text = await res.text();
              throw new Error(`HTTP ${res.status} ${text}`);
          }

          const data = await res.json();
          const models = Array.isArray(data?.data) ? data.data : [];
          setAvailableModels(models);

          const grouped = splitModelsByMedia(models);
          setSelectedModels(prev => {
              const next = { ...prev };
              if (!next.image || !grouped.image.some(m => m.id === next.image)) {
                  next.image = grouped.image[0]?.id || '';
              }
              if (!next.video || !grouped.video.some(m => m.id === next.video)) {
                  next.video = grouped.video[0]?.id || '';
              }
              localStorage.setItem('maivideo_selected_model_image', next.image || '');
              localStorage.setItem('maivideo_selected_model_video', next.video || '');
              return next;
          });

          setStatusMsg(`已加载 ${models.length} 个模型`);
      } catch (e) {
          setStatusMsg("模型列表获取失败，请检查 Base URL 或 API Key");
          console.warn("Fetch models failed:", e);
      }
  }, []);

  // --- 娣囶喖顦查悙鐧哥窗閸掓繂顫愰崠鏍у涧閹笛嗩攽娑撯偓濞?(娓氭繆绂嗛弫鎵矋娑撹櫣鈹? ---
    useEffect(() => {
      const initApp = async () => {
          try {
              const storedKey = localStorage.getItem('maivideo_api_key');
              const storedBaseUrl = localStorage.getItem('maivideo_base_url');
              const storedConcurrency = localStorage.getItem('maivideo_concurrency');
              const storedStream = localStorage.getItem('maivideo_enable_stream');
              const storedVideoMode = localStorage.getItem('maivideo_video_mode');
              const storedImageModel = localStorage.getItem('maivideo_selected_model_image');
              const storedVideoModel = localStorage.getItem('maivideo_selected_model_video');
              const storedCreateMode = localStorage.getItem('maivideo_create_mode');

              if (storedKey) setApiKey(storedKey);
              if (storedBaseUrl) setBaseUrl(storedBaseUrl);
              if (storedConcurrency) setConcurrency(parseInt(storedConcurrency, 10) || 3);
              if (storedStream !== null) setEnableStream(storedStream === 'true');
              if (storedVideoMode === 'sync' || storedVideoMode === 'async') setVideoMode(storedVideoMode);
              if (storedCreateMode === 'image' || storedCreateMode === 'video') setCreateMode(storedCreateMode);

              setSelectedModels({
                  image: storedImageModel || '',
                  video: storedVideoModel || '',
              });

              const items = await dbGetAllItems();
              setGeneratedVideos(items);

              if (storedBaseUrl) {
                  setTimeout(() => fetchModels(storedBaseUrl, storedKey || 'mayi666'), 300);
              }
          } catch (e) {
              console.error('鍒濆鍖栧け璐?', e);
          }
      };
      initApp();
  }, [fetchModels]);

  // --- 鏂板锛氬鐞嗘ā鍨嬪垏鎹㈠苟瀹炴椂淇濆瓨 ---
    const handleModelChange = (newModel) => {
      setSelectedModels(prev => {
          const next = { ...prev, [createMode]: newModel };
          localStorage.setItem(`maivideo_selected_model_${createMode}`, newModel || '');
          return next;
      });
  };

  useEffect(() => {
      localStorage.setItem('maivideo_create_mode', createMode);
  }, [createMode]);

  useEffect(() => {
      localStorage.setItem('maivideo_video_mode', videoMode);
  }, [videoMode]);
    const saveSettings = () => {
      const cleanUrl = normalizeBaseUrl(baseUrl);

      setBaseUrl(cleanUrl);
      localStorage.setItem('maivideo_api_key', apiKey);
      localStorage.setItem('maivideo_base_url', cleanUrl);
      localStorage.setItem('maivideo_concurrency', String(concurrency));
      localStorage.setItem('maivideo_enable_stream', String(enableStream));

      setShowSettings(false);
      setStatusMsg('配置已更新');
      fetchModels(cleanUrl, apiKey);
  };

  const clearHistory = () => {
    showConfirm("确定要清空所有历史记录吗？", async () => {
        await dbClearStore();
        setGeneratedVideos([]);
        localStorage.removeItem('maivideo_history');
        addLog("历史记录已清空");
    });
  };

      const processFile = (mode, file, slotId) => {
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
          showAlert(`文件过大 (${(file.size / 1024 / 1024).toFixed(2)}MB)，上限 20MB`, '文件体积过大');
          return;
      }
      if (file.type && !file.type.startsWith('image/')) {
          showAlert('只能上传图片格式文件', '格式错误');
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          updateSlots(mode, prev => prev.map(slot => {
              if (slot.id !== slotId) return slot;
              let newImages = [...slot.images, reader.result];
              if (newImages.length > 6) newImages = newImages.slice(0, 6);
              if (slot.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(slot.videoUrl);
              return { ...slot, images: newImages, status: 'idle', errorMsg: '', videoUrl: null, streamContent: '', logs: [] };
          }));
      };
      reader.readAsDataURL(file);
  };

  const parseErrorMessage = async (res) => {
      const text = await res.text();
      if (!text) return `HTTP ${res.status}`;
      try {
          const json = JSON.parse(text);
          return json?.error?.message || json?.message || text;
      } catch {
          return text;
      }
  };

  const generateImageByChat = async (mode, slotId, slot, modelId, cleanBaseUrl) => {
      const endpoint = `${cleanBaseUrl}/v1/chat/completions`;

      const content = [];
      let finalPrompt = slot.prompt.trim();
      if (slot.aspectRatio && slot.aspectRatio !== '1:1') {
          finalPrompt += ` --ar ${slot.aspectRatio}`;
      }
      content.push({ type: 'text', text: finalPrompt });

      slot.images.forEach((imgDataUrl) => {
          content.push({
              type: 'image_url',
              image_url: { url: imgDataUrl },
          });
      });

      const requestBody = {
          model: modelId || 'default',
          messages: [{ role: 'user', content }],
          stream: enableStream,
          max_tokens: 4096,
      };

      addSlotLog(slotId, '正在连接 API...', 'info', mode);
      addSlotLog(slotId, `模型: ${modelId || 'default'}`, 'info', mode);

      try {
          const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
              const errText = await response.text();
              throw new Error(`API Error: ${response.status} - ${errText}`);
          }

          let finalContent = '';
          let finalUrl = '';

          if (enableStream && response.body) {
              addSlotLog(slotId, '连接成功，任务排队中...', 'success', mode);
              const reader = response.body.getReader();
              const decoder = new TextDecoder('utf-8');
              let buffer = '';

              while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                      if (!line.startsWith('data: ')) continue;
                      const jsonStr = line.slice(6);
                      if (jsonStr.trim() === '[DONE]') break;
                      try {
                          const json = JSON.parse(jsonStr);
                          const delta = json.choices?.[0]?.delta?.content || '';
                          if (!delta) continue;
                          finalContent += delta;

                          const logLines = delta.split('\n').filter(l => l.trim().length > 0);
                          logLines.forEach((l) => {
                              if (l.includes('![') || l.includes('data:image')) return;
                              let type = 'info';
                              if (l.includes('Error') || l.includes('Failed')) type = 'error';
                              else if (l.includes('Success') || l.includes('Done')) type = 'success';
                              else if (l.includes('Warn')) type = 'warning';
                              if (l.length < 200) addSlotLog(slotId, l.trim(), type, mode);
                          });
                      } catch {
                          // ignore invalid streaming chunks
                      }
                  }
              }

              addSlotLog(slotId, '流传输结束，正在提取结果...', 'success', mode);
          } else {
              addSlotLog(slotId, '等待同步响应... (可能较慢)', 'warning', mode);
              const data = await response.json();
              finalContent = data.choices?.[0]?.message?.content || '';
              addSlotLog(slotId, '收到响应数据', 'success', mode);
          }

          let urlMatch = finalContent.match(/\((https?:\/\/[^)]+)\)/) || finalContent.match(/(https?:\/\/[^\s\n]+)/);
          if (!urlMatch) {
              const b64Match = finalContent.match(/(data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+)/);
              if (b64Match) urlMatch = b64Match;
              else if (finalContent.trim().startsWith('data:image')) urlMatch = [null, finalContent.trim()];
          }

          if (urlMatch) {
              finalUrl = urlMatch[1];
              addSlotLog(slotId, '获取到图片数据，准备显示', 'success', mode);
          } else {
              addSlotLog(slotId, '未找到有效图片链接', 'error', mode);
          }

          return { url: finalUrl, raw: finalContent };
      } catch (error) {
          addSlotLog(slotId, `请求异常: ${error.message}`, 'error', mode);
          throw error;
      }
  };

  // 按用户要求恢复最初生图逻辑：统一走 chat/completions
  const generateImageByEndpoint = async (mode, slotId, slot, modelId, cleanBaseUrl) => {
      return generateImageByChat(mode, slotId, slot, modelId, cleanBaseUrl);
  };

  const generateVideoByChat = async (mode, slotId, slot, modelId, cleanBaseUrl) => {
      const endpoint = `${cleanBaseUrl}/v1/chat/completions`;
      const content = [];
      let finalPrompt = slot.prompt.trim();
      if (slot.aspectRatio && slot.aspectRatio !== '1:1') {
          finalPrompt += ` --ar ${slot.aspectRatio}`;
      }
      content.push({ type: 'text', text: finalPrompt });
      slot.images.forEach((imgDataUrl) => {
          content.push({
              type: 'image_url',
              image_url: { url: imgDataUrl },
          });
      });

      const requestBody = {
          model: modelId || 'default',
          messages: [{ role: 'user', content }],
          stream: enableStream,
          max_tokens: 4096,
      };

      addSlotLog(slotId, '视频接口不可用，切换 chat/completions 兼容模式...', 'warning', mode);
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
          throw new Error(await parseErrorMessage(response));
      }

      let finalContent = '';
      if (enableStream && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim() === '[DONE]') continue;
                  try {
                      const json = JSON.parse(jsonStr);
                      const delta = json?.choices?.[0]?.delta?.content || '';
                      if (delta) finalContent += delta;
                  } catch {
                      // ignore invalid streaming chunks
                  }
              }
          }
      } else {
          const data = await response.json();
          finalContent = data?.choices?.[0]?.message?.content || safeStringify(data);
      }

      const allLinks = finalContent.match(/https?:\/\/[^\s)\]]+/g) || [];
      const pickedUrl = allLinks.find((u) => isVideoUrl(u)) || allLinks[0] || '';
      if (!pickedUrl) {
          throw new Error('兼容模式未返回可用视频地址');
      }

      try {
          const blobUrl = await fetchVideoResourceToBlobUrl(pickedUrl, cleanBaseUrl);
          return { url: blobUrl, raw: finalContent, taskId: '' };
      } catch (error) {
          addSlotLog(slotId, `兼容模式直链下载失败，改用原始地址播放: ${error?.message || String(error)}`, 'warning', mode);
          return { url: pickedUrl, raw: finalContent, taskId: '' };
      }
  };

  const resolveAbsoluteUrl = (rawUrl = '', cleanBaseUrl = '') => {
      if (!rawUrl) return '';
      if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
      return `${cleanBaseUrl.replace(/\/+$/, '')}/${rawUrl.replace(/^\/+/, '')}`;
  };

  const NN2_PROXY_PREFIX = '/__nn2_proxy';

  const shouldUseNn2Proxy = (absoluteUrl = '') => {
      try {
          if (typeof window === 'undefined') return false;
          const uiHost = window.location.hostname || '';
          const isLocalUi = uiHost === 'localhost' || uiHost === '127.0.0.1';
          if (!isLocalUi) return false;
          const target = new URL(absoluteUrl);
          return /(^|\.)api\.nn2\.top$/i.test(target.hostname);
      } catch {
          return false;
      }
  };

  const toRuntimeFetchUrl = (targetUrl, cleanBaseUrl) => {
      const absoluteUrl = resolveAbsoluteUrl(targetUrl, cleanBaseUrl);
      if (!absoluteUrl) return '';
      if (!shouldUseNn2Proxy(absoluteUrl)) return absoluteUrl;
      try {
          const u = new URL(absoluteUrl);
          return `${NN2_PROXY_PREFIX}${u.pathname}${u.search}`;
      } catch {
          return absoluteUrl;
      }
  };

  const isProtectedVideoApiEndpointUrl = (targetUrl, cleanBaseUrl = '') => {
      try {
          const absoluteUrl = resolveAbsoluteUrl(targetUrl, cleanBaseUrl);
          const u = new URL(absoluteUrl);
          const base = cleanBaseUrl ? new URL(cleanBaseUrl) : null;
          const sameApiOrigin = base ? (u.origin === base.origin) : /(^|\.)api\.nn2\.top$/i.test(u.hostname);
          if (!sameApiOrigin) return false;
          return /^\/v1\/videos\/[^/]+\/content$/.test(u.pathname) || /^\/api\/task\/preview\/[^/]+$/.test(u.pathname);
      } catch {
          return false;
      }
  };

  const shouldAttachApiAuth = (targetUrl, cleanBaseUrl) => {
      if (!targetUrl || !cleanBaseUrl) return true;
      try {
          const target = new URL(resolveAbsoluteUrl(targetUrl, cleanBaseUrl));
          const base = new URL(cleanBaseUrl);
          return target.origin === base.origin;
      } catch {
          return true;
      }
  };

  const buildAuthHeaders = ({
      includeJson = false,
      targetUrl = '',
      cleanBaseUrl = '',
      authMode = 'always', // always | auto | never
  } = {}) => {
      const headers = {
          Accept: 'application/json,video/*,*/*',
      };
      const shouldAttach = authMode === 'always'
          || (authMode === 'auto' && shouldAttachApiAuth(targetUrl, cleanBaseUrl));
      if (shouldAttach) {
          headers.Authorization = `Bearer ${apiKey}`;
      }
      if (includeJson) headers['Content-Type'] = 'application/json';
      return headers;
  };

  const fetchWithAuthVariants = async (url, init, cleanBaseUrl, { includeJson = false } = {}) => {
      const modes = ['always'];
      if (!shouldAttachApiAuth(url, cleanBaseUrl)) {
          modes.push('never');
      }
      const requestUrl = toRuntimeFetchUrl(url, cleanBaseUrl);

      let lastError = null;
      let lastResponse = null;
      for (const mode of modes) {
          try {
              const response = await fetch(requestUrl, {
                  ...init,
                  headers: buildAuthHeaders({
                      includeJson,
                      targetUrl: url,
                      cleanBaseUrl,
                      authMode: mode,
                  }),
              });
              lastResponse = response;

              // 非鉴权错误不重试，直接返回交给上层处理。
              if (!(response.status === 401 || response.status === 403)) {
                  return response;
              }
          } catch (error) {
              lastError = error;
          }
      }

      if (lastResponse) return lastResponse;
      throw lastError || new Error('请求失败');
  };

  const fetchVideoResourceToBlobUrl = async (resourceUrl, cleanBaseUrl, depth = 0) => {
      if (!resourceUrl) throw new Error('视频资源地址为空');
      if (depth > 2) throw new Error('视频资源重定向层级过深');

      const absoluteUrl = resolveAbsoluteUrl(resourceUrl, cleanBaseUrl);

      const res = await fetchWithAuthVariants(absoluteUrl, {
          method: 'GET',
          redirect: 'follow',
      }, cleanBaseUrl, { includeJson: false });

      if (!res.ok) {
          throw new Error(await parseErrorMessage(res));
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
          const payload = await res.json();
          const nestedUrl = pickMediaUrlFromPayload(payload, 'video');
          if (!nestedUrl) {
              throw new Error(`视频资源返回 JSON，但未找到可播放地址: ${safeStringify(payload)}`);
          }
          if (nestedUrl === resourceUrl) {
              throw new Error('视频资源返回循环地址');
          }
          return fetchVideoResourceToBlobUrl(nestedUrl, cleanBaseUrl, depth + 1);
      }

      const blob = await res.blob();
      if (!blob || blob.size <= 0) {
          throw new Error('视频内容为空');
      }
      return URL.createObjectURL(blob);
  };

  const downloadVideoContent = async (mode, slotId, cleanBaseUrl, taskId, statusPayload) => {
      const contentEndpoint = `${cleanBaseUrl}/v1/videos/${encodeURIComponent(taskId)}/content`;
      addSlotLog(slotId, '任务完成，正在拉取视频内容...', 'success', mode);

      const statusVideoUrl = pickMediaUrlFromPayload(statusPayload, 'video');
      if (statusVideoUrl) {
          addSlotLog(slotId, '状态响应已包含视频地址，优先尝试下载...', 'info', mode);
          try {
              const blobUrl = await fetchVideoResourceToBlobUrl(statusVideoUrl, cleanBaseUrl);
              return { url: blobUrl, raw: safeStringify(statusPayload), taskId };
          } catch (statusErr) {
              const directUrl = resolveAbsoluteUrl(statusVideoUrl, cleanBaseUrl);
              if (!isProtectedVideoApiEndpointUrl(directUrl, cleanBaseUrl)) {
                  addSlotLog(slotId, `状态地址下载失败，改用直链播放: ${statusErr?.message || String(statusErr)}`, 'warning', mode);
                  return {
                      url: directUrl,
                      raw: safeStringify(statusPayload),
                      taskId,
                      fallbackError: statusErr?.message || String(statusErr),
                  };
              }
              addSlotLog(slotId, `状态地址是受保护接口，不能直链播放，继续尝试 content 接口: ${statusErr?.message || String(statusErr)}`, 'warning', mode);
          }
      }

      try {
          const res = await fetch(toRuntimeFetchUrl(contentEndpoint, cleanBaseUrl), {
              method: 'GET',
              headers: buildAuthHeaders({
                  includeJson: true,
                  targetUrl: contentEndpoint,
                  cleanBaseUrl,
                  authMode: 'always',
              }),
              redirect: 'follow',
          });

          if (!res.ok) {
              throw new Error(await parseErrorMessage(res));
          }

          const contentType = (res.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('application/json')) {
              const payload = await res.json();
              const url = pickMediaUrlFromPayload(payload, 'video');
              if (!url) {
                  throw new Error(`视频内容响应为 JSON，但未找到可播放地址: ${safeStringify(payload)}`);
              }
              try {
                  const blobUrl = await fetchVideoResourceToBlobUrl(url, cleanBaseUrl);
                  return { url: blobUrl, raw: safeStringify(payload), taskId };
              } catch (contentUrlErr) {
                  const directUrl = resolveAbsoluteUrl(url, cleanBaseUrl);
                  if (!isProtectedVideoApiEndpointUrl(directUrl, cleanBaseUrl)) {
                      addSlotLog(slotId, `content 地址下载失败，改用直链播放: ${contentUrlErr?.message || String(contentUrlErr)}`, 'warning', mode);
                      return {
                          url: directUrl,
                          raw: safeStringify(payload),
                          taskId,
                          fallbackError: contentUrlErr?.message || String(contentUrlErr),
                      };
                  }
                  addSlotLog(slotId, `content 返回的是受保护接口，不能直链播放: ${contentUrlErr?.message || String(contentUrlErr)}`, 'warning', mode);
                  throw contentUrlErr;
              }
          }

          const blob = await res.blob();
          if (!blob || blob.size <= 0) {
              throw new Error('视频内容为空');
          }

          const url = URL.createObjectURL(blob);
          return { url, raw: safeStringify(statusPayload), taskId };
      } catch (error) {
          const fallbackUrl = `${cleanBaseUrl}/api/task/preview/${encodeURIComponent(taskId)}`;
          addSlotLog(slotId, '主下载失败，尝试预览接口兜底...', 'warning', mode);
          try {
              const previewBlobUrl = await fetchVideoResourceToBlobUrl(fallbackUrl, cleanBaseUrl);
              return { url: previewBlobUrl, raw: safeStringify(statusPayload), taskId, fallbackError: error?.message || String(error) };
          } catch (previewError) {
              addSlotLog(slotId, `预览接口也失败: ${previewError?.message || String(previewError)}`, 'error', mode);
              if (statusVideoUrl) {
                  const directUrl = resolveAbsoluteUrl(statusVideoUrl, cleanBaseUrl);
                  if (!isProtectedVideoApiEndpointUrl(directUrl, cleanBaseUrl)) {
                      addSlotLog(slotId, '下载链路受限，最终回退到状态直链播放', 'warning', mode);
                      return {
                          url: directUrl,
                          raw: safeStringify(statusPayload),
                          taskId,
                          fallbackError: `${error?.message || String(error)}; ${previewError?.message || String(previewError)}`,
                      };
                  }
              }
              throw new Error(`视频内容接口需要 Bearer 鉴权，且当前跨域环境无法稳定下载。请使用本地代理后重试。错误: ${error?.message || String(error)}; ${previewError?.message || String(previewError)}`);
          }
      }
  };

  const generateVideoByEndpoint = async (mode, slotId, slot, modelId, cleanBaseUrl) => {
      const createEndpoint = `${cleanBaseUrl}/v1/videos`;
      const baseBody = {
          model: modelId,
          prompt: slot.prompt.trim(),
          seconds: '10',
          size: resolveVideoSize(slot.aspectRatio),
      };
      addSlotLog(slotId, '提交视频任务...', 'info', mode);
      const createBodies = [{ label: 'text-only', body: baseBody }];
      if (slot.images.length > 0) {
          const refImage = slot.images[0];
          createBodies.unshift(
              { label: 'with-image-url', body: { ...baseBody, image_url: refImage } },
              { label: 'with-image', body: { ...baseBody, image: refImage } },
          );
          addSlotLog(slotId, '检测到参考图，将按兼容字段自动尝试提交', 'info', mode);
      }

      let createRes = null;
      let lastCreateErrMsg = '';
      for (let i = 0; i < createBodies.length; i += 1) {
          const current = createBodies[i];
          if (current.label !== 'text-only') {
              addSlotLog(slotId, `提交变体: ${current.label}`, 'info', mode);
          }

          createRes = await fetch(toRuntimeFetchUrl(createEndpoint, cleanBaseUrl), {
              method: 'POST',
              headers: buildAuthHeaders({
                  includeJson: true,
                  targetUrl: createEndpoint,
                  cleanBaseUrl,
                  authMode: 'always',
              }),
              body: JSON.stringify(current.body),
          });

          if (createRes.ok) {
              break;
          }

          const errMsg = await parseErrorMessage(createRes);
          lastCreateErrMsg = errMsg;
          const lower = String(errMsg || '').toLowerCase();
          const shouldFallbackToChat = [404, 405, 501].includes(createRes.status)
              || lower.includes('not found')
              || lower.includes('unsupported');
          if (shouldFallbackToChat) {
              addSlotLog(slotId, `/v1/videos 不可用，自动切换兼容模式: ${errMsg}`, 'warning', mode);
              return generateVideoByChat(mode, slotId, slot, modelId, cleanBaseUrl);
          }

          const isLast = i === createBodies.length - 1;
          if (!isLast) {
              addSlotLog(slotId, `变体失败(${createRes.status})，尝试下一种提交方式...`, 'warning', mode);
              continue;
          }
      }

      if (!createRes || !createRes.ok) {
          throw new Error(lastCreateErrMsg || '视频任务提交失败');
      }

      const createPayload = await createRes.json();
      const taskId = pickTaskIdFromPayload(createPayload);
      if (!taskId) {
          const url = pickMediaUrlFromPayload(createPayload, 'video');
          if (url) return { url, raw: safeStringify(createPayload), taskId: '' };
          throw new Error(`提交成功但未返回 task_id: ${safeStringify(createPayload)}`);
      }

      addSlotLog(slotId, `任务已创建: ${taskId}`, 'success', mode);

      let statusPayload = createPayload;
      let status = normalizeTaskStatus(pickTaskStatusFromPayload(statusPayload));
      let backoffCount = 0;
      const pollIntervalMs = 3000;
      const maxWaitSeconds = videoMode === 'sync' ? 240 : null;
      const startedAt = Date.now();

      for (;;) {
          if (status === 'completed') break;
          if (status === 'failed') {
              const failMsg = getJsonPath(statusPayload, 'error.message') || getJsonPath(statusPayload, 'error') || safeStringify(statusPayload);
              throw new Error(`视频任务失败: ${failMsg}`);
          }
          if (status === 'cancelled') {
              throw new Error('视频任务已取消');
          }
          if (maxWaitSeconds && (Date.now() - startedAt) / 1000 > maxWaitSeconds) {
              throw new Error('等待超时(>240s)，请切换异步模式或稍后重试');
          }

          addSlotLog(slotId, '任务排队/处理中，3 秒后轮询状态...', 'info', mode);
          await sleep(pollIntervalMs);

          const pollEndpoint = `${cleanBaseUrl}/v1/videos/${encodeURIComponent(taskId)}`;
          const pollRes = await fetch(toRuntimeFetchUrl(pollEndpoint, cleanBaseUrl), {
              method: 'GET',
              headers: buildAuthHeaders({
                  includeJson: true,
                  targetUrl: pollEndpoint,
                  cleanBaseUrl,
                  authMode: 'always',
              }),
          });

          if (pollRes.status === 429) {
              const retryMs = [2000, 4000, 8000][Math.min(backoffCount, 2)];
              backoffCount += 1;
              addSlotLog(slotId, `轮询限流(429)，${Math.floor(retryMs / 1000)} 秒后重试`, 'warning', mode);
              await sleep(retryMs);
              continue;
          }

          if (!pollRes.ok) {
              throw new Error(await parseErrorMessage(pollRes));
          }

          backoffCount = 0;
          statusPayload = await pollRes.json();
          status = normalizeTaskStatus(pickTaskStatusFromPayload(statusPayload));
          const progress = getJsonPath(statusPayload, 'progress');
          const progressText = typeof progress === 'number' ? ` (${progress}%)` : '';
          const statusLabelMap = {
              queued: '排队中',
              in_progress: '处理中',
              completed: '已完成',
              failed: '失败',
          };
          const readableStatus = statusLabelMap[status] || status || 'unknown';
          addSlotLog(slotId, `任务状态: ${readableStatus}${progressText}`, 'info', mode);
      }

      status = normalizeTaskStatus(pickTaskStatusFromPayload(statusPayload));
      if (status !== 'completed') {
          throw new Error('视频任务未完成，请稍后重试');
      }

      return downloadVideoContent(mode, slotId, cleanBaseUrl, taskId, statusPayload);
  };

  const handleGenerate = async (mode, slotId) => {
      const slot = (slotsByMode[mode] || []).find(s => s.id === slotId);
      const modelId = selectedModels[mode] || '';

      if (!slot) return;
      if (!slot.prompt.trim()) {
          showAlert('请输入提示词');
          return;
      }
      if (!modelId) {
          showAlert('请先选择模型');
          setShowSettings(true);
          return;
      }

      updateSlots(mode, prev => prev.map(s => s.id === slotId ? {
          ...s,
          status: 'generating',
          errorMsg: '',
          streamContent: '',
          logs: [],
      } : s));

      setIsGenerating(true);
      setStatusMsg(mode === 'video'
          ? `正在创建视频任务（${videoMode === 'sync' ? '同步模式 ≤240s' : '异步轮询模式'}）...`
          : '正在生成图片...');
      addSlotLog(slotId, `模型: ${modelId}`, 'info', mode);

      try {
          const cleanBaseUrl = normalizeBaseUrl(baseUrl);
          const result = mode === 'video'
              ? await generateVideoByEndpoint(mode, slotId, slot, modelId, cleanBaseUrl)
              : await generateImageByEndpoint(mode, slotId, slot, modelId, cleanBaseUrl);

          if (!result?.url) {
              throw new Error('接口返回成功但未获取到媒体地址');
          }

          updateSlots(mode, prev => prev.map(s => {
              if (s.id !== slotId) return s;
              if (s.videoUrl?.startsWith('blob:') && s.videoUrl !== result.url) URL.revokeObjectURL(s.videoUrl);
              return {
                  ...s,
                  status: 'success',
                  errorMsg: '',
                  videoUrl: result.url,
                  mediaType: mode === 'video' ? 'video' : 'image',
                  streamContent: result.raw || '',
              };
          }));

          await saveVideoToHistory({
              id: Date.now(),
              url: result.url,
              prompt: slot.prompt,
              model: modelId,
              modelType: mode === 'video' ? 'videos-api' : 'flow2api',
              mediaType: mode === 'video' ? 'video' : 'image',
              mode,
              taskId: result.taskId || '',
              isWebPage: false,
              timestamp: new Date().toLocaleString(),
          });

          setStatusMsg(mode === 'video' ? '视频生成完成' : '图片生成完成');
      } catch (error) {
          const errMsg = error?.message || String(error);
          addSlotLog(slotId, `生成失败: ${errMsg}`, 'error', mode);
          updateSlots(mode, prev => prev.map(s => s.id === slotId ? { ...s, status: 'error', errorMsg: errMsg } : s));
      } finally {
          setIsGenerating(false);
      }
  };

  const handleBatchImageUpload = (mode, slotId, e) => {
      processFile(mode, e.target.files?.[0], slotId);
      e.target.value = '';
  };

  const removeImage = (mode, slotId, index) => {
      updateSlots(mode, prev => prev.map(s => s.id === slotId ? { ...s, images: s.images.filter((_, i) => i !== index) } : s));
  };

  const updateSlotAspectRatio = (mode, id, ratio) => {
      updateSlots(mode, prev => prev.map(s => s.id === id ? { ...s, aspectRatio: ratio } : s));
  };

  const updateSlotPrompt = (mode, id, slotPrompt) => {
      updateSlots(mode, prev => prev.map(s => s.id === id ? { ...s, prompt: slotPrompt } : s));
  };

  const clearBatchSlot = (mode, id) => {
      updateSlots(mode, prev => prev.map(s => {
          if (s.id !== id) return s;
          if (s.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(s.videoUrl);
          return { ...s, images: [], prompt: '', videoUrl: null, status: 'idle', errorMsg: '', streamContent: '', logs: [] };
      }));
  };

  const handleImageDragStart = (e, mode, slotId, index) => {
      e.stopPropagation();
      e.dataTransfer.setData('maivideo/image-sort', JSON.stringify({ mode, slotId, index }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDrop = (e, mode, targetSlotId, targetIndex) => {
      e.preventDefault();
      e.stopPropagation();
      const dataStr = e.dataTransfer.getData('maivideo/image-sort');
      if (!dataStr) return;

      let payload;
      try {
          payload = JSON.parse(dataStr);
      } catch {
          return;
      }

      const { mode: sourceMode, slotId: sourceSlotId, index: sourceIndex } = payload;
      if (sourceMode !== mode) return;

      updateSlots(mode, prev => {
          const newSlots = [...prev];
          const sourceSlotIndex = newSlots.findIndex(s => s.id === sourceSlotId);
          const targetSlotIndex = newSlots.findIndex(s => s.id === targetSlotId);
          if (sourceSlotIndex === -1 || targetSlotIndex === -1) return prev;

          if (sourceSlotId === targetSlotId) {
              const images = [...newSlots[sourceSlotIndex].images];
              const [movedImage] = images.splice(sourceIndex, 1);
              const insertIndex = targetIndex !== undefined ? targetIndex : images.length;
              images.splice(insertIndex, 0, movedImage);
              newSlots[sourceSlotIndex] = { ...newSlots[sourceSlotIndex], images };
          } else {
              const targetImages = [...newSlots[targetSlotIndex].images];
              if (targetImages.length < 6) {
                  const imageToCopy = newSlots[sourceSlotIndex].images[sourceIndex];
                  const insertIndex = targetIndex !== undefined ? targetIndex : targetImages.length;
                  targetImages.splice(insertIndex, 0, imageToCopy);
                  newSlots[targetSlotIndex] = { ...newSlots[targetSlotIndex], images: targetImages };
              }
          }

          return newSlots;
      });
  };

  const handleSlotDragEnter = (e, mode, id) => {
      e.preventDefault();
      updateSlots(mode, prev => prev.map(s => s.id === id ? { ...s, isDragOver: true } : s));
  };

  const handleSlotDragOver = (e) => e.preventDefault();

  const handleSlotDragLeave = (e, mode, id) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
          updateSlots(mode, prev => prev.map(s => s.id === id ? { ...s, isDragOver: false } : s));
      }
  };

  const handleSlotDrop = (e, mode, id) => {
      e.preventDefault();
      updateSlots(mode, prev => prev.map(s => s.id === id ? { ...s, isDragOver: false } : s));

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          Array.from(e.dataTransfer.files).forEach(file => processFile(mode, file, id));
          return;
      }

      handleImageDrop(e, mode, id, undefined);
  };

  const handleCategoryChange = (catId) => { setGalleryCategory(catId); setGalleryRefreshKey(Date.now()); };
  const getGalleryImageUrl = () => {
      if (galleryCategory === 'r18') return `https://moe.jitsu.top/img/?sort=r18&t=${galleryRefreshKey}`;
      return `https://api.anosu.top/img/?sort=${galleryCategory}&t=${galleryRefreshKey}`;
  };

  const MediaViewer = ({ url, mediaType, streamContent, logs, status }) => {
      if (!url && (status === 'generating' || (logs && logs.length > 0))) {
          return <TerminalConsole logs={logs} />;
      }
      
      if (!url) return null;

      const isDataUrl = url.startsWith('data:image');
      const isImage = mediaType === 'image' || isDataUrl || url.match(/\.(jpeg|jpg|png|webp)$/i);
      const isVideoFile = mediaType === 'video' || url.match(/\.(mp4|mov|webm)$/i);

      if (isImage) {
          return (
              <div className="w-full h-full relative group bg-black flex items-center justify-center cursor-zoom-in" onClick={() => setLightboxImage(url)}>
                  <img src={url} alt="Generated" className="w-full h-full object-contain" />
                  {/* 涓嬭浇鎸夐挳 */}
                  <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSecure(url, `maivideo_${Date.now()}.png`);
                    }} 
                    className="absolute top-2 right-2 bg-black/60 hover:bg-purple-600 text-white p-2 rounded transition-all opacity-0 group-hover:opacity-100 z-10"
                    title="下载高清原图"
                  >
                      <Download className="w-4 h-4" />
                  </button>
              </div>
          );
      }
      if (isVideoFile) {
          return (
              <div className="w-full h-full relative group bg-black">
                   <video src={url} controls playsInline className="w-full h-full object-contain" />
                   <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSecure(url, `maivideo_${Date.now()}.mp4`);
                    }} 
                    className="absolute top-2 right-2 bg-black/60 hover:bg-purple-600 text-white p-2 rounded transition-all opacity-0 group-hover:opacity-100 z-10"
                    title="下载视频"
                   >
                       <Download className="w-4 h-4" />
                   </button>
              </div>
          );
      }
      return <TerminalConsole logs={logs || []} />; 
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">
      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur text-xs py-2 px-4 border-t border-white/10 z-50 flex justify-between text-slate-400 font-mono">
          <div className="flex gap-4 items-center">
              <span className="flex items-center gap-1">{apiKey ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}<span className="hidden sm:inline">Flow2API</span></span>
              <span className="flex items-center gap-1 truncate max-w-[150px]"><LinkIcon className="w-3 h-3" />{baseUrl}</span>
              {selectedModel && <span className="flex items-center gap-1 text-purple-300"><Layers className="w-3 h-3"/> {selectedModel}</span>}
          </div>
          <span className="truncate pl-4 text-purple-300">{statusMsg}</span>
      </div>

      <nav className="flex items-center justify-between px-6 py-4 backdrop-blur-md bg-slate-900/50 border-b border-white/10 sticky top-0 z-50">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div><span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">{APP_NAME}</span></div>
        <button onClick={() => setShowSettings(true)}><Settings className="w-5 h-5 text-slate-300" /></button>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        <div className="flex justify-center mb-8 bg-slate-900/60 p-1 rounded-xl border border-white/10 w-fit mx-auto">
            {['create', 'history', 'gallery'].map(t => <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>{t === 'create' ? '工作台' : t === 'history' ? '历史记录' : '随机图鉴'}</button>)}
        </div>

        {activeTab === 'create' && (
            <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
                <div className="grid grid-cols-1 gap-8 mb-8">
                     <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-950/50 p-2 rounded-lg border border-white/10">
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex bg-slate-900/80 rounded border border-white/10 overflow-hidden">
                                <button
                                    onClick={() => setCreateMode('image')}
                                    className={`px-3 py-1 text-xs ${createMode === 'image' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    生图
                                </button>
                                <button
                                    onClick={() => setCreateMode('video')}
                                    className={`px-3 py-1 text-xs ${createMode === 'video' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    生视频
                                </button>
                            </div>
                            <div className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30 flex items-center gap-1 relative min-w-[170px]">
                                <Server className="w-3 h-3 shrink-0"/>
                                <span className="whitespace-nowrap opacity-70">模型:</span>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => handleModelChange(e.target.value)}
                                    className="bg-transparent border-none outline-none text-purple-300 text-xs w-full cursor-pointer appearance-none truncate pr-4"
                                    title={selectedModel}
                                >
                                    {currentModeModels.length > 0
                                        ? currentModeModels.map(m => <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">{m.id}</option>)
                                        : <option value="" disabled className="bg-slate-900 text-slate-500">点击右侧刷新模型</option>}
                                </select>
                                <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none opacity-50" />
                            </div>
                            {createMode === 'video' && (
                                <div className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs border border-cyan-500/30 flex items-center gap-1 relative min-w-[140px]">
                                    <Clock className="w-3 h-3 shrink-0"/>
                                    <span className="whitespace-nowrap opacity-70">模式:</span>
                                    <select
                                        value={videoMode}
                                        onChange={(e) => setVideoMode(e.target.value)}
                                        className="bg-transparent border-none outline-none text-cyan-300 text-xs w-full cursor-pointer appearance-none truncate pr-4"
                                        title={videoMode === 'sync' ? '同步（≤240s）' : '异步（轮询）'}
                                    >
                                        <option value="async" className="bg-slate-900 text-slate-200">异步（轮询）</option>
                                        <option value="sync" className="bg-slate-900 text-slate-200">同步（≤240s）</option>
                                    </select>
                                    <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none opacity-50" />
                                </div>
                            )}
                            <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30 flex items-center gap-1">
                                <Zap className="w-3 h-3"/> 并发: {concurrency}
                            </div>
                        </div>
                        <button onClick={() => fetchModels(baseUrl, apiKey)} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                            <RotateCw className="w-3 h-3"/> 刷新模型
                        </button>
                     </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {batchSlots.map(slot => (
                        <div key={slot.id} className="flex flex-col lg:flex-row gap-4 bg-slate-950/30 p-4 rounded-xl border border-white/5">
                            {/* Upload */}
                            <div className={`w-full lg:w-1/5 relative group rounded-lg border border-dashed flex flex-col transition-all min-h-[120px] ${slot.isDragOver ? 'border-purple-500 bg-purple-500/20' : 'border-white/20 bg-slate-900/50'}`}
                                onDragEnter={e => handleSlotDragEnter(e, createMode, slot.id)} onDragOver={handleSlotDragOver} onDragLeave={e => handleSlotDragLeave(e, createMode, slot.id)} onDrop={e => handleSlotDrop(e, createMode, slot.id)}>
                                {slot.images.length > 0 ? <div className="p-2 grid grid-cols-3 gap-2">{slot.images.map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded overflow-hidden group/img cursor-move" draggable onDragStart={(e) => handleImageDragStart(e, createMode, slot.id, i)} onDrop={(e) => handleImageDrop(e, createMode, slot.id, i)} onDragOver={(e) => e.preventDefault()}>
                                        <img src={img} className="w-full h-full object-cover"/><button onClick={e=>{e.stopPropagation();removeImage(createMode, slot.id, i)}} className="absolute top-0 right-0 bg-red-500 p-0.5 rounded-bl opacity-0 group-hover/img:opacity-100"><XCircle className="w-3 h-3 text-white"/></button>
                                    </div>
                                ))}{slot.images.length < 6 && <label className="cursor-pointer aspect-square flex items-center justify-center border border-white/10 rounded hover:bg-white/5"><Plus className="w-4 h-4 text-slate-500"/><input type="file" className="hidden" accept="image/*" onChange={e=>handleBatchImageUpload(createMode, slot.id,e)}/></label>}</div> 
                                : <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-slate-500 hover:text-purple-400"><UploadCloud className="w-6 h-6 mb-2"/><span className="text-xs">拖拽上传 / 粘贴</span><input type="file" className="hidden" accept="image/*" onChange={e=>handleBatchImageUpload(createMode, slot.id,e)}/></label>}
                            </div>
                            {/* Controls */}
                            <div className="w-full lg:w-[35%] flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">提示词</span>
                                    <div className="flex items-center gap-1"><Ratio className="w-3 h-3 text-yellow-500"/><select value={slot.aspectRatio} onChange={e=>updateSlotAspectRatio(createMode, slot.id,e.target.value)} className="bg-slate-900 border border-yellow-500/30 text-[10px] text-yellow-500 rounded focus:outline-none">{aspectRatios.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                                </div>
                                <textarea value={slot.prompt} onChange={e => updateSlotPrompt(createMode, slot.id, e.target.value)} className="w-full h-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:border-purple-500" placeholder="描述你想要的画面..." />
                                <button onClick={() => handleGenerate(createMode, slot.id)} disabled={slot.status === 'generating'} className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2">
                                    {slot.status === 'generating' ? <Loader2 className="animate-spin w-4 h-4" /> : <PlayCircle className="w-4 h-4" />} {slot.status === 'generating' ? '生成中...' : (createMode === 'video' ? '开始生视频' : '开始生图')}
                                </button>
                            </div>
                            {/* Preview */}
                            <div className="w-full lg:flex-1 aspect-video bg-black rounded-lg overflow-hidden border border-white/5 relative flex items-center justify-center">
                                {/* 浣跨敤鏂扮殑 TerminalConsole 鏇夸唬鍘熸潵鐨勯瑙堥€昏緫锛屽綋鐢熸垚涓垨鏈夋棩蹇楁椂鏄剧ず缁堢 */}
                                <MediaViewer url={slot.videoUrl} mediaType={slot.mediaType} streamContent={slot.streamContent} logs={slot.logs} status={slot.status} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Gallery & History Tabs */}
        {activeTab === 'gallery' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
                <div className="flex flex-wrap justify-center gap-3">
                    {galleryCategories.map(cat => (
                        <button key={cat.id} onClick={() => handleCategoryChange(cat.id)} className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border ${galleryCategory === cat.id ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                            {cat.icon} {cat.name}
                        </button>
                    ))}
                </div>
                <div className="relative w-full max-w-3xl aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
                    <img key={galleryRefreshKey} src={getGalleryImageUrl()} alt="Random Gallery" className="w-full h-full object-contain" />
                </div>
                <button onClick={() => setGalleryRefreshKey(Date.now())} className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full shadow-lg flex items-center gap-2"><Shuffle /> 不够看就换一张</button>
            </div>
        )}
        
        {activeTab === 'history' && (
             <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-white">生成历史</h3>
                        <div className="flex gap-2">
                            <button onClick={handleExportHistory} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded flex items-center gap-1 text-slate-300 transition-colors"><Save className="w-3 h-3"/> 备份</button>
                            <label className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded flex items-center gap-1 text-slate-300 transition-colors cursor-pointer">
                                <FolderOpen className="w-3 h-3"/> 恢复
                                <input type="file" accept=".json" onChange={handleImportHistory} className="hidden" ref={fileInputRef} />
                            </label>
                        </div>
                    </div>
                    <button onClick={clearHistory} className="text-xs text-red-400 flex items-center gap-1 hover:text-red-300"><Trash2 className="w-3 h-3"/> 清空</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {generatedVideos.map((video) => (
                        <div key={video.id} className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden group">
                            <div className="relative aspect-video bg-black flex items-center justify-center">
                                <MediaViewer url={video.url} mediaType={video.mediaType} />
                                <button onClick={() => handleDeleteItem(video.id)} className="absolute top-2 left-2 bg-red-500/80 p-2 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between mb-2"><span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 rounded uppercase">{video.model || 'Unknown'}</span><span className="text-xs text-slate-500">{video.timestamp}</span></div>
                                <p className="text-sm text-slate-300 line-clamp-2 mb-2">{video.prompt}</p>
                                {video.url && (video.url.startsWith('http') || video.url.startsWith('data:') || video.url.startsWith('blob:')) && <a href={video.url} download={`maivideo_${video.id}.${video.mediaType === 'video' ? 'mp4' : 'png'}`} onClick={(e)=>e.stopPropagation()} target="_blank" className="block w-full py-2 bg-white/5 text-center text-slate-300 text-sm rounded hover:bg-white/10">下载</a>}
                            </div>
                        </div>
                    ))}
                    {generatedVideos.length === 0 && <p className="text-slate-500 text-center col-span-full py-10">暂无历史记录</p>}
                </div>
             </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 relative">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-purple-400" /> Flow2API 配置</h2>
                <div className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">API Key</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 outline-none" /></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Base URL</label><input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:8000" className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 outline-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                         <div><label className="block text-xs font-bold text-slate-400 mb-1">并发数</label><input type="number" min="1" max="10" value={concurrency} onChange={e => setConcurrency(parseInt(e.target.value, 10) || 1)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 outline-none" /></div>
                         <div className="flex flex-col justify-end">
                             {/* 閺傛澘顤冮敍姘ウ瀵繋绱舵潏鎾崇磻閸?*/}
                             <div className="flex items-center justify-between bg-slate-950 border border-white/10 rounded-lg px-3 py-2">
                                 <label className="text-xs text-slate-400">启用流式 (Stream)</label>
                                 <button onClick={() => setEnableStream(!enableStream)} className={`w-8 h-4 rounded-full relative transition-colors ${enableStream ? 'bg-purple-600' : 'bg-slate-700'}`}>
                                     <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${enableStream ? 'left-4.5' : 'left-0.5'}`}></div>
                                 </button>
                             </div>
                         </div>
                    </div>
                    <button onClick={saveSettings} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium mt-4">保存配置</button>
                </div>
            </div>
        </div>
      )}

      {/* Alert Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Info className="w-5 h-5 text-purple-500"/> {modalState.title}</h3>
                <p className="text-slate-300 text-sm mb-6 whitespace-pre-wrap">{modalState.message}</p>
                <div className="flex justify-end gap-2">
                    {modalState.type === 'confirm' && <button onClick={closeModal} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>}
                    <button onClick={handleModalConfirm} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded text-white text-sm font-bold">确定</button>
                </div>
            </div>
        </div>
      )}
      
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out" onClick={() => setLightboxImage(null)}>
            <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors"><X className="w-6 h-6" /></button>
            <img src={lightboxImage} alt="Zoomed" className="max-w-[50vw] max-h-[85vh] object-contain shadow-2xl rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      
      {/* 娴獥鏃ュ織闈㈡澘 */}
      <div className="fixed bottom-12 right-4 w-64 max-h-48 overflow-y-auto bg-black/80 text-[10px] text-green-400 p-2 rounded border border-white/10 pointer-events-none z-40 font-mono">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}
