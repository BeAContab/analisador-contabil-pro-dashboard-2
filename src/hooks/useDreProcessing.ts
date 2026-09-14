import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DreReport } from '../types';
import { ParseCancelledError } from '../utils/parserClient';
import { createDreParserClient } from '../utils/dreParserClient';

/**
 * Irmao de `useFileProcessing` (mesma logica de fila/dedup/progresso), so que
 * para arquivos de DRE em vez de balancete. Duplicado de proposito em vez de
 * generalizado: ver "Decisoes de arquitetura" do plano de implementacao da
 * DRE - o hook do balancete ja esta em producao e testado, e generalizar por
 * pouco ganho (um segundo consumidor) nao valia o risco de mexer nele.
 */
const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 40;

export function useDreProcessing() {
  const [files, setFiles] = useState<File[]>([]);
  const [reports, setReports] = useState<DreReport[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingFileName, setProcessingFileName] = useState('');
  const isProcessingRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parserRef = useRef<ReturnType<typeof createDreParserClient> | null>(null);
  if (parserRef.current === null) {
    parserRef.current = createDreParserClient();
  }

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
      parserRef.current?.dispose();
    };
  }, []);

  const processingPercent = files.length > 0 ? Math.round((processingIndex / files.length) * 100) : 0;

  const totalErrors = useMemo(() => reports.reduce((sum, report) => sum + report.errors.length, 0), [reports]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function addFiles(selected: File[]) {
    const pdfs = selected.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    const invalidCount = selected.length - pdfs.length;

    const withinSizeLimit = pdfs.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    const oversizedCount = pdfs.length - withinSizeLimit.length;

    if (oversizedCount > 0) {
      setMessage(
        `${oversizedCount} arquivo(s) acima do limite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB foram ignorados.`
      );
    } else if (invalidCount > 0) {
      setMessage('Arquivo inválido. Envie apenas arquivos PDF.');
    } else {
      setMessage('');
    }

    setFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = withinSizeLimit.filter((file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`));
      const combined = [...current, ...next];

      if (combined.length > MAX_FILES_PER_BATCH) {
        setMessage(
          `Limite de ${MAX_FILES_PER_BATCH} arquivos por lote. Os primeiros ${MAX_FILES_PER_BATCH} foram mantidos na fila.`
        );
        return combined.slice(0, MAX_FILES_PER_BATCH);
      }

      return combined;
    });
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(fileToRemove: File) {
    setFiles((current) => current.filter((file) => file !== fileToRemove));
  }

  async function processFiles() {
    if (isProcessingRef.current) return;

    if (files.length === 0) {
      setMessage('Envie um ou mais arquivos PDF para iniciar a análise.');
      return;
    }

    isProcessingRef.current = true;

    if (resetTimeoutRef.current !== null) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    setIsProcessing(true);
    setMessage('');
    setReports([]);
    setProcessingIndex(0);
    setProcessingFileName('');

    try {
      const parsed: DreReport[] = [];
      for (const [index, file] of files.entries()) {
        setProcessingIndex(index + 1);
        setProcessingFileName(file.name);
        parsed.push(await parserRef.current!.parse(file));
        setReports([...parsed]);
      }
    } catch (error) {
      if (error instanceof ParseCancelledError) {
        setMessage('Processamento cancelado.');
      } else {
        setMessage(error instanceof Error ? error.message : 'Falha ao processar os arquivos.');
      }
    } finally {
      isProcessingRef.current = false;
      resetTimeoutRef.current = setTimeout(() => {
        resetTimeoutRef.current = null;
        setIsProcessing(false);
        setProcessingIndex(0);
        setProcessingFileName('');
      }, 500);
    }
  }

  function cancelProcessing() {
    if (!isProcessingRef.current) return;
    parserRef.current?.cancel();
  }

  function clearAll() {
    if (resetTimeoutRef.current !== null) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    parserRef.current?.cancel();
    setFiles([]);
    setReports([]);
    setMessage('');
    setProcessingIndex(0);
    setProcessingFileName('');
  }

  return {
    files,
    reports,
    isProcessing,
    isDragging,
    message,
    processingIndex,
    processingFileName,
    processingPercent,
    totalErrors,
    handleFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    processFiles,
    cancelProcessing,
    clearAll
  };
}
