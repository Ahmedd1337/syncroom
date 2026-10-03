import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-page">
      <h1>This room doesn’t exist.</h1>
      <p>The page may have moved, or the link may be incomplete.</p>
      <Link className="btn btn-primary" href="/app">
        Back to your workspace
      </Link>
    </main>
  );
}
