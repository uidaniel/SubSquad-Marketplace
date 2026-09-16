import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.025em]">Sign in</h1>
      <p className="mt-1.5 text-[14px] text-ink-2">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand-ink hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-7">
        <LoginForm next={next ?? "/"} />
      </div>

      <p className="mt-7 text-[12.5px] leading-relaxed text-ink-3">
        Creators do not sign in here — you get a link on WhatsApp when a funded
        deal is waiting for you.
      </p>
    </>
  );
}
