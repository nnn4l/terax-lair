import { useEffect, useRef } from "react";

interface Props {
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void | Promise<void>;
}

export function EditContextDialog({ initialValue, onCancel, onSave }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const value = textareaRef.current?.value ?? initialValue;
      void onSave(value);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl">
        <h3 className="mb-2 text-[13px] font-semibold">Edit task context</h3>
        <textarea
          ref={textareaRef}
          defaultValue={initialValue}
          className="block min-h-48 w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10.5px] text-muted-foreground">esc cancel · ctrl/cmd+enter save</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-muted px-3 py-1 text-[12px] hover:bg-muted/70"
            >
              cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const value = textareaRef.current?.value ?? initialValue;
                void onSave(value);
              }}
              className="rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
