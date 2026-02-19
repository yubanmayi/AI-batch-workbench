import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Download, Trash2, Video, Loader2, Sparkles, X, History, Wifi, WifiOff, AlertTriangle, Link as LinkIcon, Edit3, MessageSquare, Image as ImageIcon, UploadCloud, PlayCircle, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Info, Palette, Plus, XCircle, Shuffle, Zap, Monitor, Smartphone, Layers, Flame, Ratio, Bug, FileJson, Save, FolderOpen, Move, Server, RotateCw, Radio, ChevronDown, Terminal, Activity, Clock } from 'lucide-react';

// --- 样式与动画 ---
const APP_NAME = "麻衣的批量工作台";

// --- IndexedDB 数据库工具函数 ---
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

// 辅助函数：延迟等待
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 核心升级：安全下载器 ---
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
        alert("下载出错，请尝试长按图片保存或右键另存为。");
    }
};

// --- 升级版终端日志组件 ---
const TerminalConsole = ({ logs = [] }) => {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogStyle = (text, type) => {
        if (type === 'error' || text.includes('失败') || text.includes('Error') || text.includes('failed')) return { icon: <XCircle className="w-3 h-3" />, color: 'text-red-400' };
        if (type === 'warning' || text.includes('reCAPTCHA') || text.includes('重试') || text.includes('Warning')) return { icon: <AlertTriangle className="w-3 h-3" />, color: 'text-yellow-400' };
        if (type === 'success' || text.includes('成功') || text.includes('完成') || text.includes('Success')) return { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400' };
        if (text.includes('启动') || text.includes('开始') || text.includes('Connecting')) return { icon: <Zap className="w-3 h-3" />, color: 'text-blue-400' };
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
  
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(''); 
  
  const [prompt, setPrompt] = useState(''); 
  const [generationMode, setGenerationMode] = useState('text'); 
  
  const [batchSlots, setBatchSlots] = useState(Array(10).fill(null).map((_, i) => ({
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
  })));

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

  const addSlotLog = (slotId, text, type = 'info') => {
      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setBatchSlots(prev => prev.map(s => {
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
      showConfirm("确定要永久删除这条记录吗？\n删除后无法恢复哦。", async () => {
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
              showAlert("还没有历史记录可以导出哦~");
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
          showAlert("备份文件已生成！\n请在弹出的下载框中选择保存位置（例如 D盘）。", "导出成功");
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
              showAlert(`成功恢复了 ${count} 条记录！`, "导入成功");
          } catch (err) {
              showAlert("无法读取该文件，请确保是正确的备份文件。\n" + err.message, "导入失败");
          }
      };
      reader.readAsText(file);
      event.target.value = ''; 
  };

  // --- 修复点：移除了 [selectedModel] 依赖，防止循环重置 ---
  const fetchModels = useCallback(async (currentBaseUrl, currentApiKey) => {
      try {
          setStatusMsg("正在获取模型列表...");
          const cleanUrl = currentBaseUrl.replace(/\/+$/, '');
          const res = await fetch(`${cleanUrl}/v1/models`, {
              headers: { 'Authorization': `Bearer ${currentApiKey}` }
          });
          if (res.ok) {
              const data = await res.json();
              if (data.data && Array.isArray(data.data)) {
                  setAvailableModels(data.data);
                  // 注意：这里不再自动设置 selectedModel，防止覆盖用户的选择
                  // 仅在首次加载且用户未设置时才可能需要，但最好让用户自己选或读取缓存
                  setStatusMsg(`已加载 ${data.data.length} 个模型`);
                  return;
              }
          }
          throw new Error("格式不匹配");
      } catch (e) {
          setStatusMsg("模型列表获取失败，请检查 Base URL");
          console.warn("Fetch models failed:", e);
      }
  }, []);

  // --- 修复点：初始化只执行一次 (依赖数组为空) ---
  useEffect(() => {
    const initApp = async () => {
        try {
            const storedKey = localStorage.getItem('maivideo_api_key');
            const storedBaseUrl = localStorage.getItem('maivideo_base_url');
            const storedConcurrency = localStorage.getItem('maivideo_concurrency');
            const storedModel = localStorage.getItem('maivideo_selected_model');
            const storedStream = localStorage.getItem('maivideo_enable_stream'); 
            
            if (storedKey) setApiKey(storedKey);
            if (storedBaseUrl) setBaseUrl(storedBaseUrl);
            if (storedConcurrency) setConcurrency(parseInt(storedConcurrency));
            if (storedModel) setSelectedModel(storedModel); // 仅在初始化时从缓存读取
            if (storedStream !== null) setEnableStream(storedStream === 'true');

            const items = await dbGetAllItems();
            setGeneratedVideos(items);

            if (storedBaseUrl) {
                // 延迟一点获取模型，避免阻塞
                setTimeout(() => fetchModels(storedBaseUrl, storedKey || 'mayi666'), 500);
            }

        } catch (e) {
            console.error("初始化失败:", e);
        }
    };
    initApp();
  }, [fetchModels]);

  // --- 新增：处理模型切换并实时保存 ---
  const handleModelChange = (newModel) => {
      setSelectedModel(newModel);
      localStorage.setItem('maivideo_selected_model', newModel);
  };

  const saveSettings = () => {
    let cleanUrl = baseUrl.trim().replace(/\/+$/, '');
    if (cleanUrl.endsWith('/v1')) cleanUrl = cleanUrl.slice(0, -3);
    
    setBaseUrl(cleanUrl);
    localStorage.setItem('maivideo_api_key', apiKey);
    localStorage.setItem('maivideo_base_url', cleanUrl);
    localStorage.setItem('maivideo_concurrency', concurrency);
    // 这里不再强制保存 selectedModel，因为它在切换时已经保存了
    localStorage.setItem('maivideo_enable_stream', String(enableStream));
    
    setShowSettings(false);
    setStatusMsg('配置已更新');
    fetchModels(cleanUrl, apiKey);
  };

  const clearHistory = () => {
    showConfirm("麻衣姐姐，确定要清空所有历史记录吗？", async () => {
        await dbClearStore();
        setGeneratedVideos([]);
        localStorage.removeItem('maivideo_history');
        addLog("历史记录已清空");
    });
  };

  const processFile = (file, slotId) => {
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { 
          showAlert(`麻衣姐姐，这张图太大了 (${(file.size / 1024 / 1024).toFixed(2)}MB)！限制 20MB 哦。`, "图片体积过大"); 
          return; 
      }
      if (file.type && !file.type.startsWith('image/')) { showAlert("只能上传图片格式的文件哦", "格式错误"); return; }

      const reader = new FileReader();
      reader.onloadend = () => {
        setBatchSlots(prev => prev.map(slot => {
            if (slot.id !== slotId) return slot;
            let newImages = [...slot.images, reader.result];
            if (newImages.length > 6) newImages = newImages.slice(0, 6);
            return { ...slot, images: newImages, status: 'idle', videoUrl: null, streamContent: '', logs: [] };
        }));
      };
      reader.readAsDataURL(file);
  };

  // --- 核心：Flow2API 统一流式请求 ---
  const generateWithFlow2API = async (slotId, images, currentPrompt, aspectRatio) => {
      const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
      const endpoint = `${cleanBaseUrl}/v1/chat/completions`;
      
      const content = [];
      let finalPrompt = currentPrompt;
      if (aspectRatio && aspectRatio !== '1:1') {
          finalPrompt += ` --ar ${aspectRatio}`; 
      }
      content.push({ type: "text", text: finalPrompt });

      images.forEach(imgDataUrl => {
          content.push({
              type: "image_url",
              image_url: { url: imgDataUrl }
          });
      });

      const requestBody = {
          model: selectedModel || 'default', 
          messages: [{ role: "user", content: content }],
          stream: enableStream, 
          max_tokens: 4096 
      };

      addSlotLog(slotId, `正在连接 API...`, 'info');
      addSlotLog(slotId, `模型: ${selectedModel}`, 'info');
      
      try {
          const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
              const errText = await response.text();
              throw new Error(`API Error: ${response.status} - ${errText}`);
          }

          let finalContent = "";
          let finalUrl = "";

          if (enableStream) {
              addSlotLog(slotId, `连接成功，任务排队中...`, 'success');
              const reader = response.body.getReader();
              const decoder = new TextDecoder("utf-8");
              let buffer = '';

              while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop(); 
                  
                  for (const line of lines) {
                      if (line.startsWith('data: ')) {
                          const jsonStr = line.slice(6);
                          if (jsonStr.trim() === '[DONE]') break;
                          try {
                              const json = JSON.parse(jsonStr);
                              const delta = json.choices?.[0]?.delta?.content || "";
                              
                              if (delta) {
                                  finalContent += delta;
                                  // 解析并显示实时日志
                                  const logLines = delta.split('\n').filter(l => l.trim().length > 0);
                                  logLines.forEach(l => {
                                      if (!l.includes('![') && !l.includes('data:image')) {
                                          let type = 'info';
                                          if (l.includes('Error') || l.includes('Failed')) type = 'error';
                                          else if (l.includes('Success') || l.includes('Done')) type = 'success';
                                          else if (l.includes('Warn')) type = 'warning';
                                          if (l.length < 200) addSlotLog(slotId, l.trim(), type);
                                      }
                                  });
                              }
                          } catch (e) {}
                      }
                  }
              }
              addSlotLog(slotId, `流传输结束，正在提取结果...`, 'success');
          } 
          else {
              addSlotLog(slotId, `等待同步响应... (可能较慢)`, 'warning');
              const data = await response.json();
              finalContent = data.choices?.[0]?.message?.content || "";
              addSlotLog(slotId, `收到响应数据`, 'success');
          }

          // 提取 URL
          let urlMatch = finalContent.match(/\((https?:\/\/[^)]+)\)/) || finalContent.match(/(https?:\/\/[^\s\n]+)/);
          if (!urlMatch) {
               // 尝试匹配 Base64
               const b64Match = finalContent.match(/(data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+)/);
               if (b64Match) urlMatch = b64Match;
               else if (finalContent.trim().startsWith('data:image')) urlMatch = [null, finalContent.trim()];
          }

          if (urlMatch) {
              finalUrl = urlMatch[1];
              addSlotLog(slotId, `获取到图片数据，准备显示`, 'success');
          } else {
              addSlotLog(slotId, `未找到有效图片链接`, 'error');
          }

          return { url: finalUrl, raw: finalContent };

      } catch (error) {
          addSlotLog(slotId, `请求异常: ${error.message}`, 'error');
          throw error;
      }
  };

  const handleGenerate = async (slotId) => {
      const slot = slotId === 'main' ? { 
          id: 'main', images: [], prompt: prompt, aspectRatio: '1:1' 
      } : batchSlots.find(s => s.id === slotId);

      if (!slot) return;
      if (!slot.prompt.trim()) { showAlert("请输入提示词"); return; }
      if (!selectedModel) { showAlert("请先在设置里选择一个模型 (或刷新模型列表)"); setShowSettings(true); return; }

      if (slotId === 'main') {
          setIsGenerating(true);
          setStatusMsg("正在请求 Flow2API...");
      } else {
          // 清空该格子的日志，并设为 generating
          setBatchSlots(prev => prev.map(s => s.id === slotId ? { ...s, status: 'generating', errorMsg: '', streamContent: '', logs: [] } : s));
      }

      try {
          const { url, raw } = await generateWithFlow2API(
              slotId, 
              slotId === 'main' ? [] : slot.images, 
              slot.prompt, 
              slot.aspectRatio
          );

          if (url) {
              const isImage = url.match(/\.(jpeg|jpg|png|webp)$/i) || url.startsWith('data:image');
              const isVideo = url.match(/\.(mp4|mov|webm)$/i);
              const mediaType = isVideo ? 'video' : 'image'; 

              await saveVideoToHistory({
                  id: Date.now(),
                  url: url,
                  prompt: slot.prompt,
                  model: selectedModel,
                  modelType: 'flow2api',
                  mediaType: mediaType,
                  mode: generationMode,
                  isWebPage: false,
                  timestamp: new Date().toLocaleString()
              });

              if (slotId === 'main') {
                  showAlert("生成成功！请在历史记录查看。", "完成");
                  setActiveTab('history');
              } else {
                  setBatchSlots(prev => prev.map(s => s.id === slotId ? { 
                      ...s, 
                      status: 'success', 
                      videoUrl: url, 
                      mediaType: mediaType,
                      streamContent: raw 
                  } : s));
              }
          } else {
              if (raw && (raw.includes("error") || raw.includes("Error"))) {
                  throw new Error(raw);
              }
              setBatchSlots(prev => prev.map(s => s.id === slotId ? { 
                  ...s, status: 'success', videoUrl: null, streamContent: raw 
              } : s));
          }

      } catch (error) {
          const errMsg = error.message;
          if (errMsg.includes("reCAPTCHA")) {
             addSlotLog(slotId, `后端被 reCAPTCHA 拦截`, 'error');
             showAlert(`生成被拦截：reCAPTCHA 验证失败。\n\n建议：\n1. 在设置中关闭“流式传输”试试。\n2. 检查 Flow2API 后台日志。`, "后端验证失败");
          }
          if (slotId === 'main') {
              if(!errMsg.includes("reCAPTCHA")) showAlert(`生成失败: ${errMsg}`, "错误");
          } else {
              setBatchSlots(prev => prev.map(s => s.id === slotId ? { ...s, status: 'error', errorMsg: errMsg } : s));
          }
      } finally {
          if (slotId === 'main') setIsGenerating(false);
      }
  };

  const handleBatchImageUpload = (slotId, e) => { processFile(e.target.files?.[0], slotId); e.target.value = ''; };
  const removeImage = (slotId, index) => setBatchSlots(prev => prev.map(s => s.id === slotId ? { ...s, images: s.images.filter((_, i) => i !== index) } : s));
  const updateSlotAspectRatio = (id, r) => setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, aspectRatio: r } : s));
  const updateSlotPrompt = (id, p) => setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, prompt: p } : s));
  const clearBatchSlot = (id) => setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, images: [], prompt: '', videoUrl: null, status: 'idle', streamContent: '', logs: [] } : s));
  
  const handleImageDragStart = (e, slotId, index) => {
      e.stopPropagation(); 
      e.dataTransfer.setData("maivideo/image-sort", JSON.stringify({ slotId, index }));
      e.dataTransfer.effectAllowed = "move";
  };
  const handleImageDrop = (e, targetSlotId, targetIndex) => {
      e.preventDefault(); e.stopPropagation();
      const dataStr = e.dataTransfer.getData("maivideo/image-sort");
      if (!dataStr) return;
      const { slotId: sourceSlotId, index: sourceIndex } = JSON.parse(dataStr);
      setBatchSlots(prev => {
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
  const handleSlotDragEnter = (e, id) => { e.preventDefault(); setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, isDragOver: true } : s)); };
  const handleSlotDragOver = (e) => e.preventDefault();
  const handleSlotDragLeave = (e, id) => { if (!e.currentTarget.contains(e.relatedTarget)) setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, isDragOver: false } : s)); };
  const handleSlotDrop = (e, id) => { 
      e.preventDefault(); 
      setBatchSlots(prev => prev.map(s => s.id === id ? { ...s, isDragOver: false } : s)); 
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { Array.from(e.dataTransfer.files).forEach(f => processFile(f, id)); return; }
      handleImageDrop(e, id, undefined); 
  };
  const handleCategoryChange = (catId) => { setGalleryCategory(catId); setGalleryRefreshKey(Date.now()); };
  const getGalleryImageUrl = () => {
      if (galleryCategory === 'r18') return `https://moe.jitsu.top/img/?sort=r18&t=${galleryRefreshKey}`;
      return `https://api.anosu.top/img/?sort=${galleryCategory}&t=${galleryRefreshKey}`;
  };

  const MediaViewer = ({ url, mediaType, streamContent, logs }) => {
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
                  {/* 下载按钮 */}
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
                     <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded-lg border border-white/10">
                        <div className="flex gap-2 items-center">
                             <div className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded text-xs border border-purple-500/30 flex items-center gap-1 relative min-w-[150px]">
                                 <Server className="w-3 h-3 shrink-0"/> 
                                 <span className="whitespace-nowrap opacity-70">模型:</span>
                                 <select 
                                     value={selectedModel} 
                                     onChange={(e) => handleModelChange(e.target.value)} 
                                     className="bg-transparent border-none outline-none text-purple-300 text-xs w-full cursor-pointer appearance-none truncate pr-4" 
                                     title={selectedModel}
                                 >
                                     {availableModels.length > 0 ? (availableModels.map(m => <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">{m.id}</option>)) : (<option value="" disabled className="bg-slate-900 text-slate-500">点击右侧刷新获取模型...</option>)}
                                 </select>
                                 <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none opacity-50" />
                             </div>
                             <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30 flex items-center gap-1">
                                 <Zap className="w-3 h-3"/> 并发: {concurrency}
                             </div>
                        </div>
                        <button onClick={() => fetchModels(baseUrl, apiKey)} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"><RotateCw className="w-3 h-3"/> 刷新模型</button>
                     </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {batchSlots.map(slot => (
                        <div key={slot.id} className="flex flex-col lg:flex-row gap-4 bg-slate-950/30 p-4 rounded-xl border border-white/5">
                            {/* Upload */}
                            <div className={`w-full lg:w-1/5 relative group rounded-lg border border-dashed flex flex-col transition-all min-h-[120px] ${slot.isDragOver ? 'border-purple-500 bg-purple-500/20' : 'border-white/20 bg-slate-900/50'}`}
                                onDragEnter={e => handleSlotDragEnter(e, slot.id)} onDragOver={handleSlotDragOver} onDragLeave={e => handleSlotDragLeave(e, slot.id)} onDrop={e => handleSlotDrop(e, slot.id)}>
                                {slot.images.length > 0 ? <div className="p-2 grid grid-cols-3 gap-2">{slot.images.map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded overflow-hidden group/img cursor-move" draggable onDragStart={(e) => handleImageDragStart(e, slot.id, i)} onDrop={(e) => handleImageDrop(e, slot.id, i)} onDragOver={(e) => e.preventDefault()}>
                                        <img src={img} className="w-full h-full object-cover"/><button onClick={e=>{e.stopPropagation();removeImage(slot.id, i)}} className="absolute top-0 right-0 bg-red-500 p-0.5 rounded-bl opacity-0 group-hover/img:opacity-100"><XCircle className="w-3 h-3 text-white"/></button>
                                    </div>
                                ))}{slot.images.length < 6 && <label className="cursor-pointer aspect-square flex items-center justify-center border border-white/10 rounded hover:bg-white/5"><Plus className="w-4 h-4 text-slate-500"/><input type="file" className="hidden" accept="image/*" onChange={e=>handleBatchImageUpload(slot.id,e)}/></label>}</div> 
                                : <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-slate-500 hover:text-purple-400"><UploadCloud className="w-6 h-6 mb-2"/><span className="text-xs">拖拽上传 / 粘贴</span><input type="file" className="hidden" accept="image/*" onChange={e=>handleBatchImageUpload(slot.id,e)}/></label>}
                            </div>
                            {/* Controls */}
                            <div className="w-full lg:w-[35%] flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">提示词</span>
                                    <div className="flex items-center gap-1"><Ratio className="w-3 h-3 text-yellow-500"/><select value={slot.aspectRatio} onChange={e=>updateSlotAspectRatio(slot.id,e.target.value)} className="bg-slate-900 border border-yellow-500/30 text-[10px] text-yellow-500 rounded focus:outline-none">{aspectRatios.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
                                </div>
                                <textarea value={slot.prompt} onChange={e => updateSlotPrompt(slot.id, e.target.value)} className="w-full h-full bg-slate-900/50 border border-white/10 rounded-lg p-3 text-sm text-white resize-none focus:border-purple-500" placeholder="描述你的画面..." />
                                <button onClick={() => handleGenerate(slot.id)} disabled={slot.status === 'generating'} className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2">
                                    {slot.status === 'generating' ? <Loader2 className="animate-spin w-4 h-4" /> : <PlayCircle className="w-4 h-4" />} {slot.status === 'generating' ? '生成中 (流式)' : '开始生成'}
                                </button>
                            </div>
                            {/* Preview */}
                            <div className="w-full lg:flex-1 aspect-video bg-black rounded-lg overflow-hidden border border-white/5 relative flex items-center justify-center">
                                {/* 使用新的 TerminalConsole 替代原来的预览逻辑，当生成中或有日志时显示终端 */}
                                <MediaViewer url={slot.videoUrl} mediaType={slot.mediaType} streamContent={slot.streamContent} logs={slot.logs} />
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
                <button onClick={() => setGalleryRefreshKey(Date.now())} className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full shadow-lg flex items-center gap-2"><Shuffle /> 不够色，换一张</button>
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
                                {video.url && (video.url.startsWith('http') || video.url.startsWith('data:')) && <a href={video.url} download={`maivideo_${video.id}.png`} onClick={(e)=>e.stopPropagation()} target="_blank" className="block w-full py-2 bg-white/5 text-center text-slate-300 text-sm rounded hover:bg-white/10">下载</a>}
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
                         <div><label className="block text-xs font-bold text-slate-400 mb-1">并发数</label><input type="number" min="1" max="10" value={concurrency} onChange={e => setConcurrency(parseInt(e.target.value))} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 outline-none" /></div>
                         <div className="flex flex-col justify-end">
                             {/* 新增：流式传输开关 */}
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
      
      {/* 浮窗日志面板 */}
      <div className="fixed bottom-12 right-4 w-64 max-h-48 overflow-y-auto bg-black/80 text-[10px] text-green-400 p-2 rounded border border-white/10 pointer-events-none z-40 font-mono">
          {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}