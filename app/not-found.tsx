import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <p className="mark">Josias</p>
        <h1>That page isn't here</h1>
        <p className="lede">The week is still on the desk.</p>
        <Link className="btn btn-primary" href="/">
          Back to the week
        </Link>
      </div>
    </main>
  );
}
