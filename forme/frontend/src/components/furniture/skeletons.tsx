export function SkeletonBar({ width = '100%', height = 10 }: { width?: number | string; height?: number }) {
  return <span aria-hidden="true" className="block bg-skeleton" style={{ width, height }} />;
}

/** Skeletons match the real geometry of the table they stand in for. */
export function TableSkeleton({
  columns,
  rows = 8,
  caption,
}: {
  columns: readonly { label: string; width: string; align?: 'left' | 'right' }[];
  rows?: number;
  caption: string;
}) {
  return (
    <div className="border border-rule-strong" data-testid="table-skeleton">
      <div className="flex h-9 items-center border-b-2 border-rule-strong bg-paper">
        {columns.map((column) => (
          <div
            key={column.label}
            className={`px-2 label-caps text-muted ${column.align === 'right' ? 'text-right' : ''}`}
            style={{ width: column.width }}
          >
            {column.label}
          </div>
        ))}
      </div>
      <p className="sr-only">{caption}</p>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex h-8 items-center border-b border-rule">
          {columns.map((column, columnIndex) => (
            <div key={column.label} className="px-2" style={{ width: column.width }}>
              <SkeletonBar width={columnIndex % 3 === 0 ? '60%' : '85%'} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ lines = 6, title }: { lines?: number; title: string }) {
  return (
    <div className="border border-rule-strong p-4">
      <p className="label-caps text-muted">{title}</p>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <SkeletonBar key={index} width={index % 2 === 0 ? '92%' : '70%'} />
        ))}
      </div>
    </div>
  );
}
