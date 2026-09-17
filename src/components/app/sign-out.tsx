"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Sign out"
      title="Sign out"
      className="grid size-10 shrink-0 place-items-center rounded-[7px] lg:size-8 text-chrome-ink/50 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
    >
      <LogOut className="size-[15px]" />
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button />
    </form>
  );
}
