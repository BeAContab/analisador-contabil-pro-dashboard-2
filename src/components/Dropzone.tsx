import { ChangeEvent, DragEvent } from 'react';

interface DropzoneProps {
  isDragging: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  files: File[];
  onRemoveFile: (file: File) => void;
  isProcessing: boolean;
  onProcess: () => void;
  onClear: () => void;
}

export function Dropzone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  files,
  onRemoveFile,
  isProcessing,
  onProcess,
  onClear
}: DropzoneProps) {
  return (
    <section className="w-full space-y-8 animate-in slide-in-from-bottom-4 duration-700 fade-in">
      {/* Dropzone Area */}
      <div
        className={`relative group border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-6 transition-all duration-300 min-h-[350px] cursor-pointer overflow-hidden ${
          isDragging 
            ? 'border-primary bg-primary/5 scale-[1.02] shadow-glass-lg' 
            : 'border-surface-border bg-surface-50 backdrop-blur-sm hover:border-primary/50 hover:bg-surface-80 hover:shadow-glass'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Background Decorative Blobs */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/20 transition-colors duration-500"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none group-hover:bg-accent/20 transition-colors duration-500"></div>

        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative z-10 ${
          isDragging ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30' : 'bg-primary/10 text-primary group-hover:scale-110'
        }`}>
          <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'wght' 300" }}>cloud_upload</span>
        </div>
        
        <div className="text-center max-w-lg flex flex-col gap-2 relative z-10">
          <h3 className="text-2xl font-bold text-foreground tracking-tight">
            Arraste seus balancetes para cá
          </h3>
          <p className="text-muted-foreground text-sm">
            Suporte exclusivo para arquivos PDF. Todo o processamento é feito localmente, garantindo a segurança dos seus dados.
          </p>
        </div>

        <label htmlFor="pdf-upload" className="relative z-10 bg-foreground text-background px-8 py-3 rounded-xl font-semibold hover:bg-primary hover:text-primary-foreground hover:scale-105 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 flex items-center gap-2 cursor-pointer mt-2">
          <span className="material-symbols-outlined text-[20px]">attachment</span>
          Ou selecione os arquivos
        </label>
        
        <input 
          id="pdf-upload"
          type="file" 
          accept="application/pdf,.pdf" 
          multiple 
          className="absolute inset-0 opacity-0 cursor-pointer z-20" 
          onChange={onFileChange}
        />
      </div>

      {/* Files List Area */}
      {files.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 animate-in slide-in-from-bottom-2 fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 pb-6 border-b border-surface-border">
            <div>
              <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">library_books</span>
                {files.length} arquivo(s) na fila
              </h4>
              <p className="text-sm text-muted-foreground">Verifique a lista antes de iniciar o processamento.</p>
            </div>
            <button 
              onClick={onClear}
              className="text-error text-sm font-semibold hover:bg-error/10 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Limpar Fila
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="group flex items-center justify-between p-4 bg-surface rounded-xl border border-surface-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-foreground truncate" title={file.name}>{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemoveFile(file);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-error/10 hover:text-error transition-colors flex-shrink-0"
                  title="Remover arquivo"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-end">
            <button 
              onClick={onProcess}
              disabled={isProcessing}
              className="bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100 hover:scale-105 flex items-center gap-3 text-lg"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
                  Processando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[24px]">analytics</span>
                  Iniciar Análise
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
