import Link from "next/link";
import { ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";

export function PostLayout({
  title,
  tag,
  readTime,
  subtitle,
  nextPost,
  children,
}: {
  title: string;
  tag: string;
  readTime: string;
  subtitle?: string;
  nextPost?: { href: string; title: string; tag: string };
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All engineering posts
      </Link>

      <header className="mt-6 border-b border-edge pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge badge-live font-mono text-[10px] uppercase tracking-wider">
            {tag}
          </span>
          <span className="text-[11px] font-mono text-ink-3">{readTime}</span>
          <span className="text-[11px] text-ink-3">·</span>
          <span className="text-[11px] text-ink-3">
            SentinelSRE Architecture Notes
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink text-balance sm:text-[2rem] sm:leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{subtitle}</p>
        )}
      </header>

      <article className="prose-blog mt-8">{children}</article>

      <footer className="mt-14 space-y-5 border-t border-edge pt-8">
        <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-ink">
              See this architecture run live
            </div>
            <p className="mt-0.5 text-xs text-ink-2">
              Watch the parallel specialists, L4 Verifier, and HITL gate handle Incident #992 in the War Room.
            </p>
          </div>
          <Link
            href="/dashboard/incidents/demo-inc-992"
            className="btn btn-primary px-4 py-2.5 text-xs shrink-0"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Open Live Demo
          </Link>
        </div>

        {nextPost && (
          <Link
            href={nextPost.href}
            className="group panel panel-hover flex items-center justify-between p-5"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                Next in series · {nextPost.tag}
              </div>
              <div className="mt-1 text-sm font-semibold text-ink group-hover:text-signal">
                {nextPost.title}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-1 shrink-0" />
          </Link>
        )}
      </footer>
    </div>
  );
}

export function DiagramFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-8">
      <div className="rounded-2xl border border-edge bg-surface-2/50 p-4 sm:p-5">
        {children}
      </div>
      <figcaption className="mt-2.5 text-center text-xs text-ink-3">
        {title}
      </figcaption>
    </figure>
  );
}
