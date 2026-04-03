const VERIFIED_TOOLTIP_TEXT = '가상화폐 지갑 인증이 완료된 사용자입니다.';

type VerifiedIconProps = {
  tooltipPlacement?: 'top' | 'bottom';
};

const VerifiedIcon = ({ tooltipPlacement = 'top' }: VerifiedIconProps) => {
  const tooltipPositionClass = tooltipPlacement === 'bottom'
    ? 'top-full mt-2'
    : 'bottom-full mb-2';

  return (
    <span
      className="relative inline-flex items-center align-middle group/verified"
      tabIndex={0}
      aria-label={VERIFIED_TOOLTIP_TEXT}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="#3B82F6"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
        className="cursor-help"
      >
        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.475 13.51 1.5 12 1.5s-2.816.975-3.436 2.25c-.416-.166-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.084.965.238 1.4-1.272.65-2.148 2.02-2.148 3.6 0 1.578.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 4 3.818 4 .47 0 .92-.086 1.336-.25.62 1.276 1.926 2.25 3.436 2.25s2.816-.975 3.436-2.25c.416.166.866.25 1.336.25 2.11 0 3.818-1.79 3.818-4 0-.495-.084-.965-.238-1.4 1.272-.65 2.148-2.02 2.148-3.6zM9.763 17.404L5.378 13.02l2.12-2.12 2.264 2.265 6.464-6.464 2.12 2.12-8.583 8.583z" fill="#3B82F6" />
        <path d="M9.763 17.404L5.378 13.02l2.12-2.12 2.264 2.265 6.464-6.464 2.12 2.12-8.583 8.583z" fill="white" />
      </svg>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 ${tooltipPositionClass} -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text shadow-lg opacity-0 transition-opacity duration-150 group-hover/verified:opacity-100 group-focus/verified:opacity-100 z-[120]`}
      >
        {VERIFIED_TOOLTIP_TEXT}
      </span>
    </span>
  );
};

export default VerifiedIcon;
