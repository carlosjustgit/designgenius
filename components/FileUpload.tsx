import React, { useRef } from 'react';

interface FileUploadProps {
  label: string;
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  icon?: React.ReactNode;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, accept, file, onFileChange, icon }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`
          relative group cursor-pointer
          border-2 border-dashed rounded-xl p-6 transition-all duration-300
          flex flex-col items-center justify-center text-center
          ${file 
            ? 'border-emerald-500/50 bg-emerald-500/10' 
            : 'border-slate-600 hover:border-indigo-500 hover:bg-slate-800/50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        
        {file ? (
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
             </div>
             <div className="text-left">
                <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-emerald-400">File loaded</p>
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onFileChange(null); }}
                className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
             </button>
          </div>
        ) : (
          <>
            <div className="mb-3 p-3 bg-slate-800 rounded-full text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                {icon || (
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                )}
            </div>
            <p className="text-sm text-slate-400 font-medium">Click to upload or drag & drop</p>
            <p className="text-xs text-slate-500 mt-1">Supports PNG, JPG, WebP</p>
          </>
        )}
      </div>
    </div>
  );
};
