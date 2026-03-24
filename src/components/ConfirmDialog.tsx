interface DialogButton {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'error';
  disabled?: boolean;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  onClose: () => void;
}

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  buttons,
  onClose,
}: ConfirmDialogProps) => {
  if (!isOpen) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/78 backdrop-blur-[2px]"
        onClick={handleBackdropClick}
      />

      {/* Dialog Content */}
      <div className="relative w-full max-w-sm glass-card rounded-xl border border-glass-border p-6 space-y-4 animate-modal-in">
        {/* Header */}
        <div>
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <p className="text-sm text-text-sub leading-relaxed mt-2">
            {message.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                {index < message.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 justify-end pt-2">
          {buttons.map((button, index) => {
            const baseClass =
              'px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';

            const variantClass = {
              primary: 'btn-primary',
              secondary: 'btn-secondary',
              error: 'btn-secondary text-error hover:bg-error-bg/20',
            }[button.variant || 'primary'];

            return (
              <button
                key={index}
                type="button"
                onClick={() => button.onClick()}
                disabled={button.disabled || false}
                className={`${baseClass} ${variantClass}`}
              >
                {button.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
