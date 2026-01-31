import React, { useState, useEffect, useRef } from 'react';
import { ApiKeySelector } from './components/ApiKeySelector';
import { FileUpload } from './components/FileUpload';
import { GenerationInput, GeneratedMockup, DesignConcept, GroundingSource } from './types';
import { generateDesignConcepts, generateMockupImage, refineAndRegenerateMockup, fileToGenerativePart, getCompanyInfoFromUrl } from './services/geminiService';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [input, setInput] = useState<GenerationInput>({
    url: '',
    companyInfo: '',
    screenshot: null,
    logo: null,
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [generatedMockups, setGeneratedMockups] = useState<GeneratedMockup[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  
  // Fullscreen & Zoom State
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Auto-fill company info when URL changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Basic validation: needs dot, at least 5 chars, and API key must be ready
      if (hasApiKey && input.url && input.url.includes('.') && input.url.length > 4) {
        setIsFetchingInfo(true);
        try {
          const info = await getCompanyInfoFromUrl(input.url);
          if (info) {
            setInput(prev => ({ ...prev, companyInfo: info }));
          }
        } catch (e) {
          console.error("Failed to auto-fill info:", e);
        } finally {
          setIsFetchingInfo(false);
        }
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [input.url, hasApiKey]);

  // Reset zoom/pan when opening a new image
  useEffect(() => {
    if (fullscreenImage) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [fullscreenImage]);

  const handleGenerate = async () => {
    if (!input.screenshot) {
      setError("Please upload a screenshot of the current website.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setGeneratedMockups([]);
    setSources([]);

    try {
      // Step 1: Analyze and get prompts
      const screenshotBase64 = await fileToGenerativePart(input.screenshot);
      const { concepts, sources: foundSources } = await generateDesignConcepts(input.url, input.companyInfo, screenshotBase64);
      
      setSources(foundSources);
      setIsAnalyzing(false);

      // Initialize mockup placeholders
      const initialMockups: GeneratedMockup[] = concepts.map((concept, index) => ({
        id: `mockup-${index}`,
        conceptName: concept.name,
        description: concept.description,
        mobileImageUrl: null,
        desktopImageUrl: null,
        status: 'generating'
      }));
      setGeneratedMockups(initialMockups);

      // Step 2: Generate images for each concept (in parallel or sequence)
      const logoBase64 = input.logo ? await fileToGenerativePart(input.logo) : null;

      // We process each concept
      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];
        
        // Trigger both mobile and desktop generation in parallel for this concept
        const mobilePromise = generateMockupImage(concept, logoBase64, 'mobile')
          .then(url => {
             setGeneratedMockups(prev => prev.map(m => 
                m.id === `mockup-${i}` ? { ...m, mobileImageUrl: url } : m
             ));
             return true;
          })
          .catch(e => {
             console.error(`Mobile generation failed for concept ${i}`, e);
             return false;
          });

        const desktopPromise = generateMockupImage(concept, logoBase64, 'desktop')
          .then(url => {
             setGeneratedMockups(prev => prev.map(m => 
                m.id === `mockup-${i}` ? { ...m, desktopImageUrl: url } : m
             ));
             return true;
          })
          .catch(e => {
             console.error(`Desktop generation failed for concept ${i}`, e);
             return false;
          });

        // Wait for both to finish to update status to completed (or partial failure)
        await Promise.all([mobilePromise, desktopPromise]);

        setGeneratedMockups(prev => prev.map(m => 
          m.id === `mockup-${i}` ? { ...m, status: 'completed' } : m
        ));
      }

    } catch (err) {
      console.error("Workflow failed:", err);
      setError("Failed to analyze website. Please ensure the API key is valid and try again.");
      setIsAnalyzing(false);
    }
  };

  const handleRegenerateView = async (mockupId: string) => {
    // Find the mockup
    const mockupIndex = generatedMockups.findIndex(m => m.id === mockupId);
    if (mockupIndex === -1) return;

    // Set regenerating state for the specific view
    setGeneratedMockups(prev => prev.map((m, idx) => 
        idx === mockupIndex ? { ...m, regeneratingView: viewMode } : m
    ));

    try {
        const logoBase64 = input.logo ? await fileToGenerativePart(input.logo) : null;
        
        // Re-construct basic concept object (we don't persist prompts in GeneratedMockup for simplicity, 
        // but we can pass the name/description as context). 
        // ideally we should store the prompt, but for now we'll rely on the description + orchestrator to build a new prompt.
        const concept: DesignConcept = {
            name: generatedMockups[mockupIndex].conceptName,
            description: generatedMockups[mockupIndex].description,
            imagePrompt: `Website design for ${input.url}. Style: ${generatedMockups[mockupIndex].conceptName}. ${generatedMockups[mockupIndex].description}` // Fallback prompt
        };

        const newImageUrl = await refineAndRegenerateMockup(concept, input.companyInfo, viewMode, logoBase64);

        setGeneratedMockups(prev => prev.map((m, idx) => 
            idx === mockupIndex ? { 
                ...m, 
                regeneratingView: null,
                mobileImageUrl: viewMode === 'mobile' ? newImageUrl : m.mobileImageUrl,
                desktopImageUrl: viewMode === 'desktop' ? newImageUrl : m.desktopImageUrl,
            } : m
        ));

    } catch (e) {
        console.error("Regeneration failed", e);
        setGeneratedMockups(prev => prev.map((m, idx) => 
            idx === mockupIndex ? { ...m, regeneratingView: null } : m
        ));
    }
  };

  // Zoom Handlers
  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {!hasApiKey && <ApiKeySelector onKeySelected={() => setHasApiKey(true)} />}

      <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://res.cloudinary.com/ds6gnj6t4/image/upload/v1769678015/flow-icon_arbuwa.png" 
              alt="Logo" 
              className="w-8 h-8 rounded-lg shadow-lg shadow-indigo-500/30 object-cover" 
            />
            <h1 className="font-bold text-xl tracking-tight text-white">DesignGenius <span className="text-indigo-400 font-normal">AI</span></h1>
          </div>
          <div className="text-sm font-medium text-slate-400">
            Powered by Gemini Nano Banana Pro
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* LEFT: Input Section */}
          <div className="lg:col-span-4 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Project Details</h2>
              <p className="text-slate-400">Provide context for the AI designer.</p>
            </div>

            <div className="space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Website URL</label>
                <div className="relative">
                    <input 
                    type="text" 
                    value={input.url}
                    onChange={(e) => setInput({...input, url: e.target.value})}
                    placeholder="https://example.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    />
                    {isFetchingInfo && (
                        <div className="absolute right-3 top-3.5">
                            <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center justify-between">
                    <span>Company Information</span>
                    {isFetchingInfo && <span className="text-xs text-indigo-400 animate-pulse">Auto-filling details...</span>}
                </label>
                <textarea 
                  value={input.companyInfo}
                  onChange={(e) => setInput({...input, companyInfo: e.target.value})}
                  placeholder="Describe the company, target audience, and desired vibe (e.g., 'A luxury watch brand targeting millennials, needs to look minimalist and expensive')."
                  rows={4}
                  className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none ${isFetchingInfo ? 'opacity-70' : ''}`}
                />
              </div>

              <FileUpload 
                label="Current Website Screenshot (Required)"
                accept="image/*"
                file={input.screenshot}
                onFileChange={(f) => setInput({...input, screenshot: f})}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 17.25v-1.007M3.75 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                  </svg>
                }
              />

              <FileUpload 
                label="Company Logo (Optional)"
                accept="image/*"
                file={input.logo}
                onFileChange={(f) => setInput({...input, logo: f})}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S13.627 3 12 3m0 0c-1.657 0-3.5 4.03-3.5 9s1.5 9 3.5 9m-9-9.75a9.004 9.004 0 0 1 8.716-6.747M12 3v18" />
                  </svg>
                }
              />
              
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={isAnalyzing || !input.screenshot}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg shadow-xl flex items-center justify-center gap-2
                  transition-all duration-300 transform active:scale-95
                  ${isAnalyzing || !input.screenshot
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'
                  }
                `}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing & Searching...
                  </>
                ) : (
                  <>
                    <span>Generate Designs</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            
            {sources.length > 0 && (
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S13.627 3 12 3m0 0c-1.657 0-3.5 4.03-3.5 9s1.5 9 3.5 9m-9-9.75a9.004 9.004 0 0 1 8.716-6.747M12 3v18" />
                  </svg>
                  Sources Used
                </h3>
                <ul className="space-y-2 text-sm">
                  {sources.map((source, index) => (
                    <li key={index}>
                      <a href={source.uri} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline truncate block">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* RIGHT: Results Section */}
          <div className="lg:col-span-8">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">Generated Concepts</h2>
               
               {/* View Toggle */}
               {generatedMockups.length > 0 && (
                 <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                   <button 
                     onClick={() => setViewMode('mobile')}
                     className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'mobile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                   >
                     Mobile (9:16)
                   </button>
                   <button 
                     onClick={() => setViewMode('desktop')}
                     className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'desktop' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                   >
                     Desktop (Full Page)
                   </button>
                 </div>
               )}
             </div>
             
             {generatedMockups.length === 0 && !isAnalyzing ? (
               <div className="h-[600px] border-2 border-dashed border-slate-700 rounded-3xl flex flex-col items-center justify-center text-slate-500 p-10 text-center">
                 <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                 </div>
                 <h3 className="text-xl font-semibold mb-2">Ready to Innovate?</h3>
                 <p className="max-w-sm">Upload your screenshot and let our AI create modern, high-fidelity mockups for you.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {isAnalyzing && generatedMockups.length === 0 && (
                   // Skeleton loaders for initial analysis phase
                   [1, 2, 3].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="bg-slate-800 rounded-2xl mb-4 aspect-[9/16]"></div>
                        <div className="h-6 bg-slate-800 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                      </div>
                   ))
                 )}

                 {generatedMockups.map((mockup) => {
                   const activeImage = viewMode === 'mobile' ? mockup.mobileImageUrl : mockup.desktopImageUrl;
                   const isRegeneratingThisView = mockup.regeneratingView === viewMode;
                   const isImageReady = !!activeImage && !isRegeneratingThisView;
                   
                   return (
                    <div key={mockup.id} className="group relative bg-slate-800 rounded-3xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-2xl">
                      <div className="relative bg-slate-900 w-full aspect-[9/16]">
                        {isImageReady ? (
                          <img 
                              src={activeImage!} 
                              alt={`${mockup.conceptName} - ${viewMode}`} 
                              className="w-full h-full object-cover"
                          />
                        ) : (mockup.status === 'failed' && !isRegeneratingThisView) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-6 text-center">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                              </svg>
                              <p>Generation Failed</p>
                            </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                            {/* Loading Animation */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent animate-scan"></div>
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 z-10"></div>
                            <p className="text-indigo-300 font-medium z-10 animate-pulse">
                                {isRegeneratingThisView ? 'Improving Design...' : `Rendering ${viewMode === 'mobile' ? 'Mobile' : 'Desktop'} Design...`}
                            </p>
                            <p className="text-slate-500 text-xs mt-2">{viewMode === 'desktop' ? 'Long-scrolling layout' : 'App-like vertical layout'}</p>
                          </div>
                        )}
                        
                        {/* Overlay Actions */}
                        {isImageReady && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <a 
                              href={activeImage!} 
                              download={`${mockup.conceptName.replace(/\s+/g, '-').toLowerCase()}-${viewMode}-mockup.png`}
                              className="p-3 bg-white text-slate-900 rounded-full hover:bg-slate-200 transition-colors"
                              title="Download Image"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                            </a>
                            <button 
                              className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-colors"
                              onClick={() => setFullscreenImage(activeImage!)}
                              title="View Fullscreen"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                </svg>
                            </button>
                            
                            <button 
                              className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition-colors"
                              onClick={() => handleRegenerateView(mockup.id)}
                              title="Regenerate & Improve"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-5 flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">{mockup.conceptName}</h3>
                            <p className="text-sm text-slate-400 line-clamp-3">{mockup.description}</p>
                        </div>
                      </div>
                    </div>
                   );
                 })}
               </div>
             )}
          </div>
        </div>
      </main>

      {/* Fullscreen Modal with Pan & Zoom */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreenImage(null)}
        >
            <button 
              className="absolute top-6 right-6 z-50 p-2 bg-black/50 text-white/70 hover:text-white hover:bg-black/70 rounded-full transition-all"
              onClick={() => setFullscreenImage(null)}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Image Wrapper */}
            <div 
              className="relative transition-transform duration-75 ease-out"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={(e) => e.stopPropagation()} // Prevent click from closing modal if clicking image
            >
               <img 
                 src={fullscreenImage} 
                 alt="Fullscreen Preview" 
                 draggable={false}
                 className="max-w-full max-h-screen object-contain select-none pointer-events-none"
               />
            </div>

            {/* Zoom Controls Toolbar */}
            <div 
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-800/80 backdrop-blur-md border border-slate-700 px-6 py-3 rounded-full shadow-2xl z-50 select-none"
              onClick={(e) => e.stopPropagation()}
            >
               <button 
                 onClick={handleZoomOut}
                 disabled={zoom <= 0.5}
                 className={`p-2 rounded-full hover:bg-slate-700 transition-colors ${zoom <= 0.5 ? 'opacity-50 cursor-not-allowed' : 'text-white'}`}
                 title="Zoom Out"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                 </svg>
               </button>
               
               <span className="text-sm font-medium text-slate-200 w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
               
               <button 
                 onClick={handleZoomIn}
                 disabled={zoom >= 4}
                 className={`p-2 rounded-full hover:bg-slate-700 transition-colors ${zoom >= 4 ? 'opacity-50 cursor-not-allowed' : 'text-white'}`}
                 title="Zoom In"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                 </svg>
               </button>

               <div className="w-px h-6 bg-slate-600 mx-2"></div>

               <button 
                 onClick={handleResetZoom}
                 className="text-sm font-medium text-indigo-400 hover:text-indigo-300 px-2"
               >
                 Reset
               </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;