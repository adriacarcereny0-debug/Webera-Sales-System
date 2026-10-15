"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export function SubmitButton({
  children, pendingLabel, variant = "primary", size, className, name, value, formAction, disabled,
}: {
  children: React.ReactNode; pendingLabel?: string; variant?: ButtonVariant; size?: ButtonSize; className?: string;
  name?: string; value?: string; formAction?: (fd: FormData) => void; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending}
      name={name} value={value} formAction={formAction}>
      {pending && <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />}
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}
