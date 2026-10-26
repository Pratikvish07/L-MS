import { useAuth } from '../auth/AuthProvider';
import { PageHead } from '../components/Layout';

export function SettingsPage() {
  const { user, displayName, signOut } = useAuth();
  return (
    <>
      <PageHead title="Settings" />
      <div className="grid two-col">
        <section className="card card-pad">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>Your account</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{displayName}</dd>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
            <dt>Role</dt>
            <dd>Administrator</dd>
          </dl>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-soft-danger" onClick={() => signOut()}>Sign out</button>
          </div>
        </section>
        <section className="card card-pad">
          <h2 style={{ fontSize: 15, marginBottom: 14 }}>System</h2>
          <dl className="kv">
            <dt>Data</dt>
            <dd>Static demo data. Edits are saved in this browser only.</dd>
            <dt>Video storage</dt>
            <dd>Video files are served by the configured video API.</dd>
            <dt>Publishing</dt>
            <dd>Only uploaded recordings can be published. Faculty cannot publish.</dd>
            <dt>PHP LMS</dt>
            <dd>Not connected.</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
