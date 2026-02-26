import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User, Dumbbell, Brain, Activity, Play, CheckCircle2,
  Target, MessageSquare, Send, Loader2, Volume2,
  ArrowDown, ArrowUp, PauseCircle, Compass,
  Zap, Utensils, ChefHat, ChevronRight, X, Flame, AlertTriangle
} from 'lucide-react';

// --- CONFIGURACIÓN GEMINI ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''; // Configúrala en Netlify como variable de entorno
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = {
  planning: 'gemini-2.5-flash-preview-09-2025',
  tts: 'gemini-2.5-flash-preview-tts'
};

const STORAGE_KEYS = {
  profile: 'trainer_ai_profile_v2',
  routine: 'trainer_ai_routine_v2',
  got: 'trainer_ai_got_v2'
};

const CATEGORY_IMAGES = {
  empuje: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=600&q=80',
  'tirón': 'https://images.unsplash.com/photo-1526506118228-a4004944b414?auto=format&fit=crop&w=600&q=80',
  piernas: 'https://images.unsplash.com/photo-1566241440091-ec10de8db2e1?auto=format&fit=crop&w=600&q=80',
  core: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
  default: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80'
};

const DEFAULT_PROFILE = {
  altura: '175',
  peso: '75',
  maxPullups: '5',
  maxPushups: '15',
  entrenosCompletados: 0
};

const safeInt = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const parseGeminiJSON = (text) => {
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error('La IA devolvió un JSON inválido.');
  }
};

const extractGeminiText = (response) => {
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No se recibió texto desde Gemini.');
  return text;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('perfil');
  const [perfil, setPerfil] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)) || DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [gotState, setGotState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.got)) || null; } catch { return null; }
  });
  const [rutina, setRutina] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.routine)) || []; } catch { return []; }
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);

  const [skillRoadmap, setSkillRoadmap] = useState(null);
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false);
  const [entrenando, setEntrenando] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(perfil)), [perfil]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.routine, JSON.stringify(rutina)), [rutina]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.got, JSON.stringify(gotState)), [gotState]);

  const nivelAtleta = useMemo(() => {
    const score = safeInt(perfil.maxPullups) * 2 + safeInt(perfil.maxPushups);
    if (score < 20) return 'Inicial';
    if (score < 45) return 'Intermedio';
    return 'Avanzado';
  }, [perfil.maxPullups, perfil.maxPushups]);

  const fetchWithRetry = async (url, options, retries = 5) => {
    let delay = 800;
    let lastError = null;
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Error API (${response.status}): ${body.slice(0, 200)}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if (i === retries - 1) break;
        await new Promise((res) => setTimeout(res, delay));
        delay *= 1.9;
      }
    }
    throw lastError || new Error('Error de red desconocido.');
  };

  const callGemini = async ({ model, prompt, schema, systemInstruction, extraConfig = {} }) => {
    if (!apiKey) throw new Error('No hay API Key disponible.');
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: schema ? 'application/json' : undefined,
        responseSchema: schema,
        ...extraConfig
      }
    };
    const response = await fetchWithRetry(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    return schema ? parseGeminiJSON(extractGeminiText(response)) : extractGeminiText(response);
  };

  const validarPerfil = () => {
    const altura = clamp(safeInt(perfil.altura), 120, 230);
    const peso = clamp(safeInt(perfil.peso), 35, 200);
    const maxPullups = clamp(safeInt(perfil.maxPullups), 0, 100);
    const maxPushups = clamp(safeInt(perfil.maxPushups), 0, 300);

    if (altura <= 0 || peso <= 0) return { ok: false, msg: 'Altura y peso deben ser válidos.' };
    if (maxPullups < 0 || maxPushups < 0) return { ok: false, msg: 'Los récords deben ser positivos.' };

    setPerfil((prev) => ({ ...prev, altura: String(altura), peso: String(peso), maxPullups: String(maxPullups), maxPushups: String(maxPushups) }));
    return { ok: true, altura, peso, maxPullups, maxPushups };
  };

  const generarRutinaGoT = async () => {
    const check = validarPerfil();
    if (!check.ok) { setErrorInfo(check.msg); return; }

    setIsGenerating(true);
    setErrorInfo('');

    const prompt = `Actúa como entrenador de élite, experto en calistenia y progresión segura.
Perfil: ${check.altura} cm, ${check.peso} kg, ${check.maxPullups} dominadas estrictas, ${check.maxPushups} flexiones estrictas.
Nivel detectado: ${nivelAtleta}.
Objetivo: diseñar rutina de 4 ejercicios, progresiva, eficiente y técnicamente impecable.
Incluye anatomía (primarios/secundarios), tempo y técnica paso a paso de cada ejercicio.`;

    const schema = {
      type: 'OBJECT',
      properties: {
        nodosGoT: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { paso: { type: 'STRING' }, razonamiento: { type: 'STRING' } }, required: ['paso', 'razonamiento'] }
        },
        rutina: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              nombre: { type: 'STRING' },
              categoriaVisual: { type: 'STRING' },
              sets: { type: 'INTEGER' },
              reps: { type: 'INTEGER' },
              explicacionBreve: { type: 'STRING' },
              tempoVisual: { type: 'OBJECT', properties: { bajar: { type: 'STRING' }, pausa: { type: 'STRING' }, subir: { type: 'STRING' } }, required: ['bajar', 'pausa', 'subir'] },
              anatomia: { type: 'OBJECT', properties: { primarios: { type: 'ARRAY', items: { type: 'STRING' } }, secundarios: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['primarios', 'secundarios'] },
              pasosTecnica: { type: 'ARRAY', items: { type: 'STRING' } }
            },
            required: ['id', 'nombre', 'categoriaVisual', 'sets', 'reps', 'explicacionBreve', 'tempoVisual', 'anatomia', 'pasosTecnica']
          }
        }
      },
      required: ['nodosGoT', 'rutina']
    };

    try {
      const data = await callGemini({
        model: MODELS.planning,
        prompt,
        schema,
        systemInstruction: 'Responde SOLO con JSON válido. Enfoque práctico, preciso y seguro.'
      });

      const rutinaSegura = (data.rutina || []).map((ej, idx) => ({
        ...ej,
        id: ej.id || `ej_${idx}`,
        categoriaVisual: ['empuje', 'tirón', 'piernas', 'core'].includes((ej.categoriaVisual || '').toLowerCase())
          ? ej.categoriaVisual.toLowerCase()
          : 'default',
        sets: clamp(safeInt(ej.sets, 3), 1, 8),
        reps: clamp(safeInt(ej.reps, 8), 1, 50),
        seleccionado: true
      }));

      setGotState({ nodosGoT: data.nodosGoT || [] });
      setRutina(rutinaSegura);
      setActiveTab('ailab');
    } catch (error) {
      setErrorInfo(error.message || 'La IA está saturada. Intenta nuevamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generarRoadmapSkill = async (skillName) => {
    setIsGeneratingSkill(true);
    try {
      const data = await callGemini({
        model: MODELS.planning,
        prompt: `Atleta ${perfil.peso}kg, ${perfil.maxPullups} pullups, ${perfil.maxPushups} pushups. Skill objetivo: ${skillName}. Crea un plan de 3 fases brutalmente práctico.`,
        schema: {
          type: 'OBJECT',
          properties: {
            diagnosticoRapido: { type: 'STRING' },
            fases: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  numero: { type: 'INTEGER' },
                  nombre: { type: 'STRING' },
                  objetivoBreve: { type: 'STRING' },
                  ejercicios: { type: 'ARRAY', items: { type: 'STRING' } }
                }, required: ['numero', 'nombre', 'objetivoBreve', 'ejercicios']
              }
            }
          }, required: ['diagnosticoRapido', 'fases']
        },
        systemInstruction: 'JSON puro. Directo, accionable y sin relleno.'
      });
      setSkillRoadmap({ skill: skillName, ...data });
    } catch {
      alert('No pude generar el roadmap en este intento.');
    } finally {
      setIsGeneratingSkill(false);
    }
  };

  const modificarRutinaManual = (id, campo, valor) => {
    const val = clamp(safeInt(valor), 0, campo === 'sets' ? 12 : 100);
    setRutina((prev) => prev.map((ej) => (ej.id === id ? { ...ej, [campo]: val } : ej)));
  };

  const toggleEjercicio = (id) => setRutina((prev) => prev.map((ej) => (ej.id === id ? { ...ej, seleccionado: !ej.seleccionado } : ej)));

  const finalizarEntreno = () => {
    setPerfil((prev) => ({ ...prev, entrenosCompletados: prev.entrenosCompletados + 1 }));
    setEntrenando(false);
    setActiveTab('perfil');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans sm:pb-0 pb-20 flex justify-center">
      <div className="w-full max-w-md bg-slate-900 min-h-screen shadow-2xl relative flex flex-col overflow-hidden border-x border-slate-800">
        <header className="pt-8 pb-4 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-2 tracking-tight">
              <Zap className="w-6 h-6 text-emerald-400" /> PERSONAL TRAINER AI
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">Lógica, Anatomía y Resultados</p>
          </div>
          <span className="text-[10px] font-black px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">Nivel: {nivelAtleta}</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          {!entrenando ? (
            <>
              {activeTab === 'perfil' && <ViewPerfil perfil={perfil} setPerfil={setPerfil} onAnalizar={generarRutinaGoT} isGenerating={isGenerating} errorInfo={errorInfo} />}
              {activeTab === 'ailab' && gotState && <ViewAILab got={gotState} rutina={rutina} modificarRutina={modificarRutinaManual} toggleEjercicio={toggleEjercicio} onStart={() => setEntrenando(true)} onVerTecnica={setSelectedExercise} />}
              {activeTab === 'skills' && <ViewSkills generarRoadmap={generarRoadmapSkill} isGenerating={isGeneratingSkill} roadmap={skillRoadmap} />}
              {activeTab === 'chef' && <ViewAIChef perfil={perfil} callGemini={callGemini} />}
              {activeTab === 'coach' && <ViewAICoach perfil={perfil} callGemini={callGemini} />}
            </>
          ) : (
            <WorkoutPlayer rutina={rutina.filter((r) => r.seleccionado)} onFinish={finalizarEntreno} onCancel={() => setEntrenando(false)} fetchWithRetry={fetchWithRetry} />
          )}
        </main>

        {selectedExercise && <VisualTrainerModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}

        {!entrenando && (
          <nav className="absolute bottom-0 w-full bg-slate-950/95 backdrop-blur-md border-t border-slate-800 flex justify-between px-2 py-3 z-50">
            <BotonNav icon={<User />} text="Fuerza" active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} />
            <BotonNav icon={<Dumbbell />} text="Workout" active={activeTab === 'ailab'} onClick={() => gotState && setActiveTab('ailab')} disabled={!gotState} />
            <BotonNav icon={<Compass />} text="Skills" active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
            <BotonNav icon={<Utensils />} text="Dieta" active={activeTab === 'chef'} onClick={() => setActiveTab('chef')} />
            <BotonNav icon={<MessageSquare />} text="Coach" active={activeTab === 'coach'} onClick={() => setActiveTab('coach')} />
          </nav>
        )}
      </div>
    </div>
  );
}

function VisualTrainerModal({ exercise, onClose }) {
  const imgUrl = CATEGORY_IMAGES[(exercise?.categoriaVisual || '').toLowerCase()] || CATEGORY_IMAGES.default;
  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in slide-in-from-bottom-full duration-300">
      <div className="relative h-64 w-full bg-slate-800">
        <img src={imgUrl} alt={exercise.nombre} className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-black/80 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="absolute bottom-4 left-6 right-6">
          <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-md">{exercise.categoriaVisual}</span>
          <h2 className="text-3xl font-black text-white mt-2 leading-tight">{exercise.nombre}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-950">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-orange-500" /> Mapa Muscular</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Músculos Primarios</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(exercise?.anatomia?.primarios || []).map((musculo, i) => <span key={i} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg flex items-center gap-1.5"><Flame className="w-3 h-3" /> {musculo}</span>)}
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Músculos Estabilizadores</p>
            <div className="flex flex-wrap gap-2">
              {(exercise?.anatomia?.secundarios || []).map((musculo, i) => <span key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg">{musculo}</span>)}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" /> Ejecución Perfecta</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-800">
            {(exercise?.pasosTecnica || []).map((paso, i) => (
              <div key={i} className="relative flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center text-cyan-400 font-black text-xs shrink-0 z-10">{i + 1}</div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-1 mt-0.5"><p className="text-sm text-slate-300 leading-relaxed">{paso}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewPerfil({ perfil, setPerfil, onAnalizar, isGenerating, errorInfo }) {
  return (
    <div className="p-6 animate-in fade-in duration-300 pb-24">
      <h2 className="text-2xl font-black text-white leading-tight">Fuerza Relativa</h2>
      <p className="text-slate-400 text-xs mt-2 leading-relaxed">La IA deduce tu nivel por rendimiento real (sin cámara).</p>

      <div className="space-y-6 mt-6">
        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Tu Cuerpo</h3>
          <div className="grid grid-cols-2 gap-4">
            <InputNumber label="Altura (cm)" value={perfil.altura} onChange={(v) => setPerfil({ ...perfil, altura: v })} />
            <InputNumber label="Peso (kg)" value={perfil.peso} onChange={(v) => setPerfil({ ...perfil, peso: v })} />
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4" /> Récords Estrictos</h3>
          <div className="grid grid-cols-2 gap-4">
            <InputNumber label="Dominadas Max" value={perfil.maxPullups} onChange={(v) => setPerfil({ ...perfil, maxPullups: v })} centered />
            <InputNumber label="Flexiones Max" value={perfil.maxPushups} onChange={(v) => setPerfil({ ...perfil, maxPushups: v })} centered />
          </div>
        </div>
      </div>

      {errorInfo && <div className="mt-4 bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 text-red-300"><AlertTriangle className="w-4 h-4" /> <p className="text-xs font-bold">{errorInfo}</p></div>}

      <button onClick={onAnalizar} disabled={isGenerating} className={`w-full mt-8 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black py-4 rounded-2xl flex justify-center items-center gap-2 active:scale-95 transition-all ${isGenerating ? 'opacity-80' : ''}`}>
        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
        {isGenerating ? 'DISEÑANDO RUTINA GoT...' : 'CREAR RUTINA EXPLOSIVA ✨'}
      </button>
    </div>
  );
}

function ViewAILab({ got, rutina, modificarRutina, toggleEjercicio, onStart, onVerTecnica }) {
  return (
    <div className="p-6 pb-24 animate-in slide-in-from-right duration-300">
      <h2 className="text-xl font-black text-white mb-4">Lógica del Entrenamiento</h2>
      <div className="space-y-3 mb-8">
        {(got?.nodosGoT || []).map((nodo, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-[10px] mt-0.5">{i + 1}</div>
            <div><h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest mb-1">{nodo.paso}</h4><p className="text-xs text-slate-300 leading-relaxed">{nodo.razonamiento}</p></div>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-black text-white mb-4">Tu Rutina Hoy</h3>
      <div className="space-y-4">
        {rutina.map((ej) => (
          <div key={ej.id} className={`p-4 rounded-2xl border transition-all ${ej.seleccionado ? 'bg-slate-800 border-slate-600' : 'bg-slate-950 border-slate-800 opacity-50'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleEjercicio(ej.id)}>
                <div className={`w-6 h-6 rounded flex items-center justify-center border ${ej.seleccionado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>{ej.seleccionado && <CheckCircle2 className="w-4 h-4 text-slate-900" />}</div>
                <p className="font-black text-white text-base leading-tight">{ej.nombre}</p>
              </div>
              {ej.seleccionado && <button onClick={() => onVerTecnica(ej)} className="bg-slate-900 border border-slate-700 text-cyan-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-1">Ver Técnica <ChevronRight className="w-3 h-3" /></button>}
            </div>

            {ej.seleccionado && (
              <>
                <p className="text-[11px] text-emerald-300 font-medium mb-4 italic leading-relaxed">"{ej.explicacionBreve}"</p>
                <div className="flex gap-3 mb-4">
                  <ConfigBox label="Sets" value={ej.sets} onChange={(e) => modificarRutina(ej.id, 'sets', e.target.value)} />
                  <ConfigBox label="Reps" value={ej.reps} onChange={(e) => modificarRutina(ej.id, 'reps', e.target.value)} />
                </div>
                <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex justify-between items-center px-4">
                  <Tempo icon={<ArrowDown className="w-4 h-4 text-orange-400 mb-0.5" />} text={ej.tempoVisual?.bajar} />
                  <span className="text-slate-700 text-xs">|</span>
                  <Tempo icon={<PauseCircle className="w-4 h-4 text-yellow-400 mb-0.5" />} text={ej.tempoVisual?.pausa} />
                  <span className="text-slate-700 text-xs">|</span>
                  <Tempo icon={<ArrowUp className="w-4 h-4 text-emerald-400 mb-0.5" />} text={ej.tempoVisual?.subir} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => rutina.some((r) => r.seleccionado) && onStart()} className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl flex justify-center items-center gap-2">
        <Play className="w-5 h-5 fill-current" /> INICIAR ENTRENAMIENTO
      </button>
    </div>
  );
}

function ViewSkills({ generarRoadmap, isGenerating, roadmap }) {
  const skillsDisponibles = ['Muscle Up', 'Front Lever', 'Planche', 'Handstand', 'Pistol Squat'];
  return (
    <div className="p-6 pb-24 animate-in slide-in-from-right duration-300">
      <h2 className="text-2xl font-black text-white">Domina las Skills</h2>
      <div className="flex flex-wrap gap-2 mb-6 mt-4">
        {skillsDisponibles.map((skill) => <button key={skill} onClick={() => generarRoadmap(skill)} disabled={isGenerating} className={`px-4 py-2.5 rounded-full border font-bold text-xs ${roadmap?.skill === skill ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-300'} ${isGenerating ? 'opacity-50' : ''}`}>{skill}</button>)}
      </div>
      {isGenerating && <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" /><p className="text-sm font-bold text-white">Diseñando ruta...</p></div>}
      {roadmap && !isGenerating && <div className="bg-slate-900 border border-slate-700/50 rounded-3xl p-6"><h3 className="text-2xl font-black text-white mb-2">{roadmap.skill}</h3><p className="text-sm text-cyan-300 font-medium mb-6 italic">"{roadmap.diagnosticoRapido}"</p>{roadmap.fases?.map((fase, i) => <div key={i} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl mb-3"><h4 className="text-sm font-black text-white">FASE {fase.numero}: {fase.nombre}</h4><p className="text-[11px] text-slate-400 mb-3">{fase.objetivoBreve}</p>{fase.ejercicios?.map((ej, idx) => <div key={idx} className="bg-slate-900 rounded-lg p-2.5 text-xs text-slate-200 font-medium border border-slate-800 mb-2">{ej}</div>)}</div>)}</div>}
    </div>
  );
}

function ViewAIChef({ perfil, callGemini }) {
  const [ingredientes, setIngredientes] = useState('');
  const [isCooking, setIsCooking] = useState(false);
  const [receta, setReceta] = useState(null);

  const generarReceta = async () => {
    if (!ingredientes.trim()) return;
    setIsCooking(true);
    setReceta(null);
    try {
      const data = await callGemini({
        model: MODELS.planning,
        prompt: `Ingredientes: ${ingredientes}. Crea receta funcional alta en proteína para atleta de ${perfil.peso}kg.`,
        schema: {
          type: 'OBJECT', properties: {
            nombre: { type: 'STRING' },
            macros: { type: 'OBJECT', properties: { proteinas: { type: 'STRING' }, carbs: { type: 'STRING' }, grasas: { type: 'STRING' }, calorias: { type: 'STRING' } }, required: ['proteinas', 'carbs', 'grasas', 'calorias'] },
            pasos: { type: 'ARRAY', items: { type: 'STRING' } }
          }, required: ['nombre', 'macros', 'pasos']
        },
        systemInstruction: 'Chef de alto rendimiento. JSON puro, receta realista y simple.'
      });
      setReceta(data);
    } catch {
      alert('Error al generar receta.');
    } finally {
      setIsCooking(false);
    }
  };

  return <div className="p-6 pb-24"><h2 className="text-xl font-black text-white flex items-center gap-2 mb-4"><ChefHat className="w-6 h-6 text-orange-400" /> Chef IA</h2><textarea value={ingredientes} onChange={(e) => setIngredientes(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white text-sm h-24 mb-4" placeholder="Ej: pollo, arroz, huevos..." /><button onClick={generarReceta} disabled={isCooking || !ingredientes.trim()} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black py-4 rounded-2xl">{isCooking ? 'COCINANDO...' : 'GENERAR RECETA'}</button>{receta && <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-6"><h3 className="text-xl font-black text-white mb-4">{receta.nombre}</h3><ol className="space-y-3">{receta.pasos?.map((paso, idx) => <li key={idx} className="text-sm text-slate-300"><span className="text-orange-400 font-black mr-2">{idx + 1}.</span>{paso}</li>)}</ol></div>}</div>;
}

function ViewAICoach({ perfil, callGemini }) {
  const [messages, setMessages] = useState([{ role: 'model', text: 'Conozco tus récords. ¿Qué duda de entrenamiento tienes hoy?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);
    try {
      const responseText = await callGemini({
        model: MODELS.planning,
        prompt: `Historial:\n${[...messages, { role: 'user', text: userText }].map((m) => `${m.role}: ${m.text}`).join('\n')}\nResponde al último mensaje.`,
        systemInstruction: `Coach deportivo experto. Usuario: ${perfil.maxPullups} pullups. Respuesta corta y accionable.`
      });
      setMessages((prev) => [...prev, { role: 'model', text: responseText }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'model', text: 'No pude responder por red. Intenta otra vez.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return <div className="p-6 pb-24 h-[88vh] flex flex-col"><h2 className="text-xl font-black text-white flex items-center gap-2 mb-4"><MessageSquare className="w-5 h-5 text-cyan-400" /> Tutor Chat</h2><div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-4 overflow-y-auto mb-4 space-y-4">{messages.map((msg, i) => <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${msg.role === 'user' ? 'bg-cyan-600 text-slate-900' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>{msg.text}</div></div>)}{isTyping && <div className="text-slate-500 text-xs">Escribiendo...</div>}<div ref={endRef} /></div><div className="flex gap-2"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white" placeholder="Pregunta técnica..." /><button onClick={handleSend} disabled={isTyping} className="bg-cyan-500 text-slate-900 p-3.5 rounded-2xl"><Send className="w-5 h-5" /></button></div></div>;
}

function pcmToWav(pcmData, sampleRate) {
  const numChannels = 1; const bitsPerSample = 16; const byteRate = sampleRate * numChannels * (bitsPerSample / 8); const blockAlign = numChannels * (bitsPerSample / 8);
  const wavData = new ArrayBuffer(44 + pcmData.byteLength); const view = new DataView(wavData);
  const writeString = (v, o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + pcmData.byteLength, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true); writeString(view, 36, 'data'); view.setUint32(40, pcmData.byteLength, true);
  new Uint8Array(wavData, 44).set(new Uint8Array(pcmData));
  return wavData;
}

const base64ToArrayBuffer = (b64) => {
  const str = window.atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
};

function WorkoutPlayer({ rutina, onFinish, onCancel, fetchWithRetry }) {
  const [ejIdx, setEjIdx] = useState(0);
  const [setActual, setSetActual] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  const ejActivo = rutina[ejIdx];
  if (!ejActivo) return <div className="p-6"><p className="text-white">No hay ejercicios seleccionados.</p><button onClick={onCancel} className="mt-3 bg-slate-800 text-white p-2 rounded">Volver</button></div>;

  const completarSet = () => {
    if (setActual < ejActivo.sets) setSetActual((p) => p + 1);
    else if (ejIdx < rutina.length - 1) { setEjIdx((p) => p + 1); setSetActual(1); }
    else onFinish();
  };

  const playMotivation = async () => {
    if (isSpeaking || !apiKey) return;
    setIsSpeaking(true);
    try {
      const url = `${GEMINI_BASE_URL}/${MODELS.tts}:generateContent?key=${apiKey}`;
      const res = await fetchWithRetry(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Make Speaker1 intense and excited: ¡Fuerte! ${ejActivo.reps} reps de ${ejActivo.nombre}.` }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } }
        })
      });
      const b64 = res?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error('No audio');
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(new Blob([pcmToWav(base64ToArrayBuffer(b64), 24000)], { type: 'audio/wav' }));
      if (audioRef.current) {
        audioRef.current.src = audioUrlRef.current;
        audioRef.current.play();
        audioRef.current.onended = () => setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col">
      <div className="px-6 py-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <div><p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Actividad {ejIdx + 1} / {rutina.length}</p><h2 className="text-lg font-black text-white">{ejActivo.nombre}</h2></div>
        <button onClick={onCancel} className="text-[10px] text-slate-400 border border-slate-700 px-3 py-2 rounded-lg">Salir</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center w-full max-w-sm">
          <button onClick={playMotivation} disabled={isSpeaking} className={`absolute -mt-14 ml-64 bg-emerald-500 text-slate-900 p-4 rounded-full ${isSpeaking ? 'animate-pulse' : ''}`}><Volume2 className="w-6 h-6" /></button>
          <audio ref={audioRef} className="hidden" />
          <div className="flex justify-center gap-2 mb-6">{[...Array(ejActivo.sets)].map((_, i) => <div key={i} className={`h-2.5 flex-1 rounded-full ${i < setActual ? 'bg-cyan-500' : 'bg-slate-800'}`} />)}</div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Repeticiones</p>
          <h3 className="text-8xl font-black text-white mb-8">{ejActivo.reps}</h3>
          <button onClick={completarSet} className="w-full bg-cyan-500 text-slate-900 font-black py-5 rounded-2xl flex justify-center items-center gap-2 text-xl"><CheckCircle2 className="w-6 h-6" /> COMPLETAR SET</button>
        </div>
      </div>
    </div>
  );
}

function InputNumber({ label, value, onChange, centered = false }) {
  return <div><label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">{label}</label><input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white font-black focus:border-emerald-500 focus:outline-none ${centered ? 'text-center text-lg border-cyan-500/30' : ''}`} /></div>;
}

function ConfigBox({ label, value, onChange }) {
  return <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">{label}</span><input type="number" value={value} onChange={onChange} className="w-12 bg-slate-800 rounded py-1 text-white font-black text-center focus:outline-none" /></div>;
}

function Tempo({ icon, text }) {
  return <div className="flex flex-col items-center">{icon}<span className="text-[10px] font-bold text-slate-300">{text || '-'}</span></div>;
}

function BotonNav({ icon, text, active, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center gap-1 transition-all ${disabled ? 'opacity-30' : ''} ${active ? 'text-cyan-400' : 'text-slate-500'}`}>
      <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-cyan-500/15 scale-110 border border-cyan-500/20' : ''}`}>{React.cloneElement(icon, { className: 'w-5 h-5' })}</div>
      <span className="text-[9px] font-bold tracking-widest uppercase mt-0.5">{text}</span>
    </button>
  );
}
