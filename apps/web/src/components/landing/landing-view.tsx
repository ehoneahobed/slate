import Link from "next/link";

type Props = {
  signedIn: boolean;
};

function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.32] mix-blend-multiply"
      style={{
        backgroundImage:
          "radial-gradient(rgba(50,40,20,.045) 1px,transparent 1px),radial-gradient(rgba(50,40,20,.03) 1px,transparent 1px)",
        backgroundSize: "3px 3px, 7px 7px",
      }}
    />
  );
}

function HeroArt() {
  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] shadow-[var(--shadow-3)]"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(transparent 0 31px, var(--rule) 31px 32px)",
        }}
      />
      <div className="pointer-events-none absolute bottom-0 left-[60px] top-0 w-px bg-[var(--accent-soft)]" />
      <p className="absolute left-[80px] top-5 font-[family-name:var(--font-caveat)] text-3xl text-[var(--ink)] sm:text-4xl">
        Gradient descent
      </p>
      <p className="absolute left-[80px] top-[52px] font-[family-name:var(--font-caveat)] text-xl text-[var(--ink-3)] sm:text-2xl">
        — the whole idea in one picture
      </p>
      <div className="absolute left-[80px] top-[108px] rounded-md border border-dashed border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--ink-2)] sm:text-sm">
        θ<sub>t+1</sub> = θ<sub>t</sub> − η · ∇L(θ<sub>t</sub>)
      </div>
      <div
        className="absolute right-5 top-8 max-w-[150px] rotate-[3deg] rounded-sm px-3 py-2 font-[family-name:var(--font-caveat)] text-lg leading-snug text-[#4a3d10] shadow-[0_8px_16px_-8px_rgba(0,0,0,.25)]"
        style={{ background: "#fff2b0" }}
      >
        <span className="font-semibold">exam tip ✶</span>
        <br />
        if loss oscillates,
        <br />
        halve η.
      </div>
      <svg className="absolute bottom-4 left-12 right-4 h-[38%]" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M10 180 L 390 180" stroke="var(--ink-3)" strokeWidth="1.2" fill="none" />
        <path d="M10 180 L 10 20" stroke="var(--ink-3)" strokeWidth="1.2" fill="none" />
        <path d="M20 40 C 80 180, 160 200, 230 140 S 350 50, 390 100" stroke="var(--ink)" strokeWidth="2.4" fill="none" />
        <g fill="var(--accent)">
          <circle cx="40" cy="60" r="5" />
          <circle cx="90" cy="118" r="5" />
          <circle cx="140" cy="162" r="5" />
          <circle cx="180" cy="178" r="5" />
          <circle cx="210" cy="160" r="5" />
          <circle cx="222" cy="142" r="6" />
        </g>
        <text
          x="228"
          y="140"
          className="fill-[var(--accent)]"
          style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 22 }}
        >
          θ*
        </text>
      </svg>
      <div
        className="absolute bottom-[88px] right-[28%] h-3.5 w-3.5 rounded-full sm:right-[120px]"
        style={{
          background: "radial-gradient(circle,#ff3b30 0%,rgba(255,59,48,0) 70%)",
          boxShadow: "0 0 16px 6px rgba(255,59,48,.35)",
        }}
      />
      <div className="absolute bottom-4 left-[80px] inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 py-1 text-[11px] text-[var(--ink-3)]">
        continues on p15 · Assignment 1
      </div>
    </div>
  );
}

function IconNotebook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]">
      <path d="M5 3h7l3 3v11H5z" />
      <path d="M12 3v3h3" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]">
      <path d="M3 17l1.2-4 9.5-9.5a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L7 15.8 3 17z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]">
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="5" r="2" />
      <circle cx="15" cy="15" r="2" />
      <path d="M6.8 9l6.4-3M6.8 11l6.4 3" />
    </svg>
  );
}

function IconStack() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[18px] w-[18px]">
      <path d="M10 3l7 4-7 4-7-4 7-4z" />
      <path d="M3 10l7 4 7-4" />
      <path d="M3 14l7 4 7-4" />
    </svg>
  );
}

/** Marketing home — copy reflects shipped features where noted. */
export function LandingView({ signedIn }: Props) {
  const primaryHref = signedIn ? "/dashboard" : "/login";
  const primaryLabel = signedIn ? "Open dashboard" : "Get started";

  return (
    <div className="relative min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <Grain />

      <header className="relative z-10 border-b border-[var(--chrome-b)] bg-[var(--chrome)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4 sm:px-7">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--ink)] font-[family-name:var(--font-instrument-serif)] text-lg italic leading-none text-[var(--paper)]">
              S
            </span>
            <span className="font-[family-name:var(--font-instrument-serif)] text-2xl">Slate</span>
          </Link>
          <div className="flex-1" />
          <nav className="hidden items-center gap-5 text-sm text-[var(--ink-2)] sm:flex">
            <a href="#features" className="hover:text-[var(--ink)]">
              Features
            </a>
            <a href="#product" className="hover:text-[var(--ink)]">
              Today vs roadmap
            </a>
            <a href="#audience" className="hover:text-[var(--ink)]">
              For teachers
            </a>
          </nav>
          <Link
            href={primaryHref}
            className="rounded-[var(--r-md)] bg-[var(--ink)] px-3.5 py-2 text-sm font-semibold text-[var(--paper)] hover:opacity-95 sm:px-4"
          >
            {primaryLabel}
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:px-7 sm:pb-16 sm:pt-12">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--chrome-b)] bg-[var(--paper)] px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--ink-2)]">
                <span className="text-[var(--accent)]">●</span> for teachers & the students they share with
              </p>
              <h1 className="mt-4 font-[family-name:var(--font-instrument-serif)] text-[2.75rem] leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.25rem]">
                The whiteboard
                <br />
                that feels like a{" "}
                <span className="font-[family-name:var(--font-caveat)] italic text-[var(--accent)]">notebook.</span>
              </h1>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--ink-2)]">
                Organize lessons in notebooks, sections, and pages. Write with pen and highlighter on ruled or plain
                sheets — then publish a read-only link when you are ready to share.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={primaryHref}
                  className="rounded-[var(--r-md)] bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--paper)] hover:opacity-95"
                >
                  {primaryLabel} →
                </Link>
                <a
                  href="#features"
                  className="rounded-[var(--r-md)] border border-[var(--chrome-b)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                >
                  See what ships today
                </a>
              </div>
              <p className="mt-3 text-xs text-[var(--ink-3)]">Early access · no billing yet</p>
            </div>
            <HeroArt />
          </div>
        </section>

        <section id="features" className="border-t border-[var(--rule)] bg-[var(--paper)]/60 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-7">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              In the product today
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight sm:text-5xl">
              Structure, ink, and a link to{" "}
              <span className="font-[family-name:var(--font-caveat)] italic text-[var(--accent)]">share.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[var(--ink-2)]">
              Slate is under active development. These pieces are live in the web app now; the list grows every phase.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: <IconStack />,
                  title: "Notebooks & pages",
                  body: "Workspace, notebooks, sections, and pages with ruled, grid, plain, or Cornell backgrounds.",
                },
                {
                  icon: <IconPen />,
                  title: "Pen, highlighter, eraser",
                  body: "Pressure-free normalized strokes that save with debounced sync to Postgres.",
                },
                {
                  icon: <IconShare />,
                  title: "Read-only publish",
                  body: "Create a revocable share link. Viewers see your notebook without signing in.",
                },
                {
                  icon: <IconNotebook />,
                  title: "Themes & dashboard",
                  body: "Paper, clean, or dark UI themes with persistence. Sign in with email, magic link, or GitHub.",
                },
              ].map((f) => (
                <article
                  key={f.title}
                  className="flex min-h-[200px] flex-col rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-[var(--shadow-1)]"
                >
                  <div className="mb-3 grid h-9 w-9 place-items-center rounded-[9px] border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--ink-2)]">
                    {f.icon}
                  </div>
                  <h3 className="font-[family-name:var(--font-instrument-serif)] text-xl font-normal leading-snug">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-3)]">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-7">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              Roadmap (not shipped yet)
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl sm:text-4xl">What we are building next</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--ink-2)]">
              Live collaboration (e.g. Liveblocks), student annotation forks, Stripe for multi-teacher workspaces, and
              richer embeds. The static HTML prototypes in the repo show the fuller vision.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Live collab",
                "Annotate fork",
                "Voice on pages",
                "PDF & video embeds",
                "Offline sync",
                "BYO AI keys",
              ].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-1.5 text-xs text-[var(--ink-2)]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section
          id="audience"
          className="border-y border-[var(--rule)] bg-[var(--paper-2)] py-14 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-7">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              Two sides of the same page
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl sm:text-4xl">
              For teachers <span className="text-[var(--ink-3)]">·</span> For students
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--rule)] bg-gradient-to-b from-[#f5ecd8] to-[var(--paper)] p-7 shadow-[var(--shadow-1)]">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  Teacher
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-2xl sm:text-3xl">Teach across a whole semester.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">
                  One notebook per course, pages per lecture, and a calm surface that stays readable when you zoom or
                  export later.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-[var(--ink-2)]">
                  {[
                    "Reorder and manage pages from the editor sidebar",
                    "Preview layout before you share a read-only link",
                    "Optional GitHub sign-in when OAuth keys are configured",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--paper)]">
                        ✓
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[var(--rule)] bg-gradient-to-b from-[#e6dac0] to-[var(--paper)] p-7 shadow-[var(--shadow-1)]">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  Student
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-2xl sm:text-3xl">Follow along without friction.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">
                  Open a shared notebook in the browser, page by page, with ink replay that matches what the teacher
                  drew.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-[var(--ink-2)]">
                  {[
                    "Read-only shares work without an account",
                    "Planned: private margin notes on a forked copy",
                    "Planned: live sessions that follow the teacher’s focus",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--paper)]">
                        ✓
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-7">
            <blockquote className="grid gap-6 rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-8 shadow-[var(--shadow-1)] md:grid-cols-[1fr_auto] md:items-center md:gap-8">
              <div>
                <p className="font-[family-name:var(--font-instrument-serif)] text-2xl leading-snug sm:text-3xl">
                  One surface for the whole story — from the first lecture to the final review.
                </p>
                <p className="mt-3 text-sm text-[var(--ink-3)]">That is the bar we are building toward.</p>
              </div>
              <div
                className="mx-auto h-24 w-24 shrink-0 rounded-full md:mx-0"
                style={{
                  background: "repeating-linear-gradient(45deg,var(--rule) 0 4px,var(--paper-2) 4px 8px)",
                }}
              />
            </blockquote>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--rule)] bg-[var(--paper)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="font-[family-name:var(--font-instrument-serif)] text-xl">Slate</div>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--ink-3)]">
            <Link href={primaryHref} className="hover:text-[var(--ink)]">
              {primaryLabel}
            </Link>
            <Link href="/dashboard" className="hover:text-[var(--ink)]">
              Dashboard
            </Link>
          </div>
          <p className="text-xs text-[var(--ink-4)]">© {new Date().getFullYear()} Slate</p>
        </div>
      </footer>
    </div>
  );
}
