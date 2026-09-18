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

      {/* One door for everyone. This used to say creators do not sign in here
          and to wait for a WhatsApp link — on a deployment with no WhatsApp,
          to creators who now have accounts. */}
      <p className="mt-7 text-[12.5px] leading-relaxed text-ink-3">
        Agencies, brands and creators all sign in here. If you are a creator,
        you will land on your deals.
      </p>
    </>
  );
}
