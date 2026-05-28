import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, ImageIcon, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelected, disabled }) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onFileSelected(acceptedFiles[0]);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group',
          isDragActive
            ? 'border-accent-cyan bg-accent-cyan/5 glow-cyan'
            : 'border-bg-border hover:border-accent-cyan/50 hover:bg-bg-elevated',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        {/* Animated corner accents */}
        <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-accent-cyan/40 rounded-tl" />
        <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-accent-cyan/40 rounded-tr" />
        <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-accent-cyan/40 rounded-bl" />
        <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-accent-cyan/40 rounded-br" />

        <div className="flex flex-col items-center gap-4">
          <div className={clsx(
            'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
            isDragActive
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'bg-bg-elevated text-slate-400 group-hover:text-accent-cyan group-hover:bg-accent-cyan/10'
          )}>
            {isDragActive ? <ImageIcon size={28} /> : <Upload size={28} />}
          </div>

          <div>
            <p className="font-body font-medium text-slate-300 mb-1">
              {isDragActive ? 'Drop the scan here' : 'Drag & drop medical image'}
            </p>
            <p className="font-mono text-xs text-slate-500">
              JPG, PNG · Max 10MB · X-Ray, CT, MRI, Fundus
            </p>
          </div>

          <button
            type="button"
            className="px-5 py-2 rounded-lg bg-bg-elevated border border-bg-border text-sm font-body
                       text-slate-300 hover:border-accent-cyan/50 hover:text-accent-cyan transition-all"
          >
            Browse files
          </button>
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="flex items-center gap-2 text-accent-red text-sm px-1">
          <AlertCircle size={14} />
          <span>{fileRejections[0].errors[0].message}</span>
        </div>
      )}
    </div>
  );
};
