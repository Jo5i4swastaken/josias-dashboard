export function ConfigNotice() {
  return (
    <main className="auth">
      <div className="auth-card">
        <p className="mark">Josias</p>
        <h1>Server isn't configured</h1>
        <p className="lede">
          Check the environment variables in the README, generate the secrets with openssl, and restart. Production
          also needs Upstash Redis (<code>KV_REST_API_URL</code> and <code>KV_REST_API_TOKEN</code>).
        </p>
      </div>
    </main>
  );
}
