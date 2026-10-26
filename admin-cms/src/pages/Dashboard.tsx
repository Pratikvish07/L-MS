import { CheckCircle2, CloudUpload, Video, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { PageHead } from '../components/Layout';
import { StatusPill, Spinner, Thumbnail } from '../components/ui';
import { UploadsChart } from '../components/UploadsChart';
import { dayKey, formatDateTime } from '../lib/format';
import { useStore } from '../lib/store';

function Stat({ icon, value, label, bg, fg }: { icon: ReactNode; value: number; label: string; bg: string; fg: string }) {
  return (
    <div className="card stat">
      <div className="stat-icon" style={{ background: bg, color: fg }} aria-hidden>
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { recordings, loading } = useStore();
  const [date, setDate] = useState(dayKey(new Date()));
  const endDate = new Date(`${date}T12:00:00`);

  const uploaded = recordings.filter((r) => r.status === 'uploaded' || r.status === 'published').length;
  const uploading = recordings.filter((r) => r.status === 'uploading').length;
  const failed = recordings.filter((r) => r.status === 'failed').length;
  const recent = [...recordings]
    .filter((r) => r.recordedAt && dayKey(r.recordedAt) <= date)
    .sort((a, b) => (b.uploadedAt || b.updatedAt).localeCompare(a.uploadedAt || a.updatedAt))
    .slice(0, 6);

  return (
    <>
      <PageHead title="Dashboard" subtitle="Overview of lecture recordings">
        <input aria-label="Chart end date" className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </PageHead>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid stats">
            <Stat icon={<Video size={22} />} value={recordings.length} label="Total Recordings" bg="var(--primary-soft)" fg="var(--primary)" />
            <Stat icon={<CheckCircle2 size={22} />} value={uploaded} label="Uploaded" bg="var(--primary-soft)" fg="var(--primary)" />
            <Stat icon={<CloudUpload size={22} />} value={uploading} label="Uploading" bg="var(--blue-soft)" fg="var(--blue)" />
            <Stat icon={<XCircle size={22} />} value={failed} label="Failed" bg="var(--red-soft)" fg="var(--red)" />
          </div>

          <div className="grid two-col">
            <section className="card">
              <div className="card-head">
                <h2>Uploads (Last 7 Days)</h2>
              </div>
              <div className="card-pad">
                <UploadsChart recordings={recordings} endDate={endDate} />
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Recent Uploads</h2>
                <Link className="link" to="/recordings">
                  View All
                </Link>
              </div>
              <div style={{ paddingTop: 8 }}>
                {recent.length === 0 && <div className="empty">No recordings yet.</div>}
                {recent.map((r) => (
                  <Link key={r.id} to={`/recordings/${r.id}`} className="list-item">
                    <Thumbnail path={r.thumbnailPath} alt="" />
                    <div className="grow">
                      <div className="title">{r.topic}</div>
                      <div className="cell-sub">
                        {r.className} • {r.classroomName} • {r.facultyName}
                      </div>
                      <div className="cell-sub">{formatDateTime(r.recordedAt)}</div>
                    </div>
                    <StatusPill status={r.status} progress={r.uploadProgress} />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
