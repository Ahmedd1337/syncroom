import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Hash,
  MessageSquare,
  LayoutGrid,
  ShieldCheck,
  Radio,
  Paperclip,
} from "lucide-react";
import { Brand, Avatar, ThemeToggle } from "@/components/shared";
import { Button } from "@/components/ui/button";
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" aria-label="SyncRoom home">
          <Brand />
        </Link>
        <nav>
          <a href="#features">Features</a>
          <Link href="/demo">Explore the demo</Link>
        </nav>
        <div className="row">
          <ThemeToggle />
          <Link className="login-link" href="/auth/login">
            Log in
          </Link>
          <Button asChild>
            <Link href="/auth/signup">Get started</Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="mini-line" /> LESS SWITCHING. MORE SYNC.
          </div>
          <h1>
            Great work starts
            <br />
            with a shared space<span>.</span>
          </h1>
          <p>
            Bring your conversations, tasks, and team together.
            <br className="desktop-only" /> One calm workspace to turn ideas
            into progress.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/auth/signup">Create your workspace</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/demo">
                Explore the live demo <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="hero-footnote">
            <Check size={14} /> Your team. Your conversations. In sync.
          </div>
          <div className="product-preview">
            <aside>
              <Brand />
              <div className="preview-workspace">
                S{" "}
                <span>
                  Studio North <small>Team workspace</small>
                </span>
              </div>
              <div className="preview-nav">
                <LayoutGrid size={16} /> Overview
              </div>
              <div className="preview-nav">
                <MessageSquare size={16} /> All conversations
              </div>
              <label>CHANNELS</label>
              <div className="preview-nav active">
                <Hash size={16} /> product-design
              </div>
              <div className="preview-nav">
                <Hash size={16} /> general
              </div>
              <div className="preview-nav">
                <Hash size={16} /> development
              </div>
              <label>WORKSPACE</label>
              <div className="preview-nav">
                <LayoutGrid size={16} /> Tasks
              </div>
            </aside>
            <div className="preview-chat">
              <div className="preview-header">
                <Hash size={19} />
                <b>product-design</b>
                <span>Where ideas take shape</span>
                <div className="avatar-stack">
                  <Avatar name="Alex Morgan" small />
                  <Avatar name="Maya Chen" small />
                  <Avatar name="Jordan Lee" small />
                </div>
              </div>
              <div className="preview-day">TODAY</div>
              <div className="preview-message">
                <Avatar name="Maya Chen" />
                <div>
                  <b>
                    Maya Chen <time>10:24 AM</time>
                  </b>
                  <p>
                    The new onboarding flow is ready for a look. Kept things
                    simple: fewer steps, a little more breathing room.
                  </p>
                  <div className="design-file">
                    <span className="file-art">
                      <LayersIcon />
                    </span>
                    <div>
                      <b>Onboarding exploration</b>
                      <small>Design review · v2</small>
                    </div>
                    <Paperclip size={17} />
                  </div>
                  <span className="reaction">🙌 3</span>{" "}
                  <span className="reaction">✨ 2</span>
                </div>
              </div>
              <div className="preview-message">
                <Avatar name="Alex Morgan" />
                <div>
                  <b>
                    Alex Morgan <time>10:28 AM</time>
                  </b>
                  <p>
                    Love this direction. That first step feels much clearer now.
                  </p>
                  <span className="thread-label">
                    2 replies · Last reply 10:32 AM
                  </span>
                </div>
              </div>
              <div className="preview-composer">
                Message #product-design <span>↵</span>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="features">
          <div className="section-heading">
            <div className="eyebrow">ONE PLACE. SHARED MOMENTUM.</div>
            <h2>
              Stay close to the work.
              <br />
              And the people doing it.
            </h2>
            <p>The essentials your team needs, thoughtfully connected.</p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: MessageSquare,
                title: "Conversations with context",
                text: "Organize discussions in channels, reply directly, and keep the right people in the loop with mentions.",
              },
              {
                icon: LayoutGrid,
                title: "From “what if” to done",
                text: "Turn plans into a clear task board. Give every task an owner, a priority, and a next step.",
              },
              {
                icon: Radio,
                title: "Together, in real time",
                text: "See who’s around, know when someone is typing, and keep conversations moving without refreshing.",
              },
              {
                icon: ShieldCheck,
                title: "A space you can trust",
                text: "Workspace permissions and private file storage keep your team’s work within your team.",
              },
            ].map((f) => (
              <article key={f.title}>
                <f.icon size={23} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">MAKE ROOM FOR YOUR BEST WORK</span>
          <h2>
            A little less scattered.
            <br />A lot more together.
          </h2>
          <Button asChild>
            <Link href="/auth/signup">Get started with SyncRoom</Link>
          </Button>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Real-time collaboration. Room to focus.</span>
        <Link href="/demo">Try the demo</Link>
      </footer>
    </div>
  );
}
function LayersIcon() {
  return <span className="file-art-lines">S / N</span>;
}
