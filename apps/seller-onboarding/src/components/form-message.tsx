import { CircleAlert } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

/** A form-level error, announced to screen readers when it appears. */
export function FormError({ message }: { message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** One field's error, under the field. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
