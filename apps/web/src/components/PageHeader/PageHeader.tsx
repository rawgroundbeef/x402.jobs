import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Stack title and actions vertically on mobile */
  stackOnMobile?: boolean;
}

export function PageHeader({
  title,
  description,
  leftSlot,
  rightSlot,
  stackOnMobile = false,
}: PageHeaderProps) {
  return (
    <header className="py-6">
      <div
        className={
          stackOnMobile
            ? "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            : "flex items-start justify-between gap-4"
        }
      >
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          {leftSlot}
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {rightSlot && (
          <div className={stackOnMobile ? "w-full sm:w-auto sm:flex-shrink-0" : "flex-shrink-0"}>
            {rightSlot}
          </div>
        )}
      </div>
    </header>
  );
}
