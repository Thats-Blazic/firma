"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { loginAction, type LoginState } from "@/app/admin/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">E-adresa</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Lozinka</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <LogIn className="size-5" aria-hidden="true" />}
        Prijavi se
      </Button>
    </form>
  );
}
