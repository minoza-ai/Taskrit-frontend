interface PopupModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'alert' | 'confirm';
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
}

const PopupModal = ({
  open,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'confirm',
  destructive = false,
  onConfirm,
  onClose,
  busy = false,
}: PopupModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/78 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-sm glass-card rounded-xl border border-glass-border p-5 animate-modal-in">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <p className="text-sm text-text-sub leading-relaxed whitespace-pre-wrap">{message}</p>

        <div className="mt-5 flex gap-2 justify-end">
          {variant === 'confirm' && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn-secondary px-4 py-2 rounded-md text-sm"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={destructive
              ? 'btn-secondary text-error px-4 py-2 rounded-md text-sm'
              : 'btn-primary px-4 py-2 rounded-md text-sm'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PopupModal;
