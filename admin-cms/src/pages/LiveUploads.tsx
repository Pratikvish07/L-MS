import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { PageHead } from '../components/Layout';
import { Pill, StatusPill } from '../components/ui';
import { formatBytes, formatDateTime } from '../lib/format';
import { useStore } from '../lib/store';

const ACTIVE = ['recording', 'saved_locally', 'uploading', 'failed'];
const ONLINE_WINDOW_MS = 60_000;
const LIVE_RECORDING_WINDOW_MS = 15 * 60_000;

export function LiveUploadsPage() {
  const { recordings, devices } = useStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const active = recordings.filter((r) => {
    if (!ACTIVE.includes(r.status)) return false;
    const updated = Date.parse(r.updatedAt || r.recordedAt || '');
    return Number.isFinite(updated) && now - updated <= LIVE_RECORDING_WINDOW_MS;
  });

  return (
    <>
      <PageHead title="Live Uploads" subtitle="Recordings in progress and mount phone status, updated in real time" />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>In progress</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lecture</th>
                <th>Faculty</th>
                <th>Classroom</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nothing is recording or uploading right now.
                  </td>
                </tr>
              )}
              {active.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/recordings/${r.id}`} className="cell-title">
                      {r.topic}
                    </Link>
                    {r.errorMessage && <div className="error-text">{r.errorMessage}</div>}
                  </td>
                  <td>{r.facultyName}</td>
                  <td>{r.classroomName}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    {r.status === 'uploading' ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div className="progress" role="progressbar" aria-valuenow={r.uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                          <div style={{ width: `${r.uploadProgress}%` }} />
                        </div>
                        <span className="cell-sub">
                          {r.uploadProgress}% of {formatBytes(r.fileSizeBytes)}
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="cell-sub">{formatDateTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mount devices</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Controlled by</th>
                <th>Connection</th>
                <th>State</th>
                <th>Assigned lecture</th>
                <th>Free storage</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No classroom phone is under faculty control right now.
                  </td>
                </tr>
              )}
              {devices.map((d) => {
                const online = d.lastSeen > 0 && now - d.lastSeen < ONLINE_WINDOW_MS;
                return (
                  <tr key={d.mountUid}>
                    <td className="cell-title">{d.deviceName}</td>
                    <td>{d.facultyName}</td>
                    <td>{online ? <Pill tone="green">Online</Pill> : <Pill tone="gray">Offline</Pill>}</td>
                    <td style={{ textTransform: 'capitalize' }}>{online ? d.state : '—'}</td>
                    <td>{d.sessionTopic || '—'}</td>
                    <td>{formatBytes(d.freeBytes)}</td>
                    <td className="cell-sub">{d.lastSeen ? formatDateTime(new Date(d.lastSeen).toISOString()) : 'Never'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
