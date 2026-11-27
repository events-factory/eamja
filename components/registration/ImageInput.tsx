'use client';

import { useState } from 'react';

// Long edge of the uploaded photo: plenty for a badge or an attendee list.
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

interface ImageInputProps {
  id: string;
  // A base64 data URL once a photo is chosen. On the update page, it starts as
  // whatever SmartEvent saved for this delegate.
  value: string;
  hasError: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}

export default function ImageInput({
  id,
  value,
  hasError,
  onChange,
  onError,
}: ImageInputProps) {
  const [preparing, setPreparing] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared so choosing the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;

    setPreparing(true);
    try {
      onChange(await toJpegDataUrl(file));
    } catch {
      onError(
        'We could not read that image. Please choose a JPG or PNG photo.',
      );
    } finally {
      setPreparing(false);
    }
  }

  const isNew = value.startsWith('data:');
  // SmartEvent may hand back a saved photo in a form that cannot be displayed,
  // such as a bare file name, so only these get a thumbnail.
  const preview = isNew || /^https?:\/\//.test(value) ? value : null;

  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-3"
      style={{ borderColor: hasError ? '#ef4444' : 'var(--border)' }}
    >
      <div
        className="w-16 h-16 shrink-0 rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: 'var(--light)', color: 'var(--muted)' }}
      >
        {preview ? (
          // A data URL or SmartEvent's own URL; next/image suits neither.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}
      </div>

      <div className="min-w-0">
        <input
          type="file"
          id={id}
          accept="image/*"
          onChange={handleFile}
          disabled={preparing}
          className="sr-only peer"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            className="px-4 py-2 border rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors peer-focus-visible:ring-2"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {preparing
              ? 'Preparing…'
              : value
                ? 'Change photo'
                : 'Choose photo'}
          </label>
          {value && !preparing && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2 py-2 text-sm underline"
              style={{ color: 'var(--muted)' }}
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {value && !isNew
            ? 'We already have a photo for you.'
            : 'A clear photo of your face, as a JPG or PNG.'}
        </p>
      </div>
    </div>
  );
}

// Phone photos run to many megabytes, and base64 adds a third again, so the
// photo is scaled down before it goes into `delegate_data`. Re-encoding also
// means SmartEvent only ever receives a JPEG, whatever was picked. Rejects if
// the browser cannot decode the file.
async function toJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    // JPEG has no transparency, which would otherwise turn black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
