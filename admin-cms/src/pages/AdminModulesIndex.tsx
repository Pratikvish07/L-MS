import { ArrowRight, Blocks } from 'lucide-react';
import { Link } from 'react-router';

import { PageHead } from '../components/Layout';
import { ADMIN_MODULES } from '../lib/admin-modules';

const PINNED = new Set(['quizzes', 'zoom-settings', 'certificates']);

export function AdminModulesIndexPage() {
  const groups = [...new Set(ADMIN_MODULES.filter((module) => !PINNED.has(module.id)).map((module) => module.group))];

  return (
    <>
      <PageHead title="More Modules" subtitle="Additional administration pages" />
      <div className="module-directory">
        {groups.map((group) => {
          const modules = ADMIN_MODULES.filter((module) => module.group === group && !PINNED.has(module.id));
          if (!modules.length) return null;
          return (
            <section className="card module-directory-section" key={group}>
              <header className="card-head"><h2>{group}</h2></header>
              <div className="module-directory-list">
                {modules.map((module) => (
                  <Link key={module.id} to={`/modules/${module.id}`} className="module-directory-item">
                    <span className="module-directory-icon"><Blocks size={17} /></span>
                    <span className="module-directory-copy"><strong>{module.title}</strong><small>{module.description}</small></span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
