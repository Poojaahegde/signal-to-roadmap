'use client';

/**
 * page.tsx — Landing page for Signal to Roadmap
 *
 * Two CTAs:
 * 1. "Try Demo" — loads pre-built sample dataset, no API key needed
 * 2. "Start Fresh" — creates a new blank session
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, loadDemo } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<'demo' | 'fresh' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTryDemo() {
    setLoading('demo');
    setError(null);
    try {
      const { session_id } = await loadDemo();
      router.push(`/session/${session_id}/roadmap`);
    } catch (err) {
      setError('Could not load demo. Make sure the backend is running.');
      setLoading(null);
    }
  }

  async function handleStartFresh() {
    setLoading('fresh');
    setError(null);
    try {
      const session = await createSession();
      router.push(`/session/${session.id}/ingest`);
    } catch (err) {
      setError('Could not create session. Make sure the backend is running.');
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-800 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          AI-powered product intelligence
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          Turn raw customer signals into a{' '}
          <span className="text-indigo-400">prioritized roadmap</span>
        </h1>

        <p className="text-xl text-gray-400 mb-4 max-w-2xl mx-auto">
          Paste support tickets, sales call notes, and product reviews.
          Get a prioritized product roadmap with PM-quality reasoning — in under 15 minutes.
        </p>

        <p className="text-sm text-gray-500 mb-12">
          No more 10-hour synthesis sessions. No more HiPPO-driven roadmaps.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleTryDemo}
            disabled={!!loading}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-semibold text-lg transition-colors"
          >
            {loading === 'demo' ? 'Loading demo...' : 'Try Demo'}
          </button>
          <button
            onClick={handleStartFresh}
            disabled={!!loading}
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl font-semibold text-lg transition-colors border border-gray-700"
          >
            {loading === 'fresh' ? 'Creating session...' : 'Start Fresh'}
          </button>
        </div>

        {error && (
          <p className="mt-6 text-red-400 text-sm">{error}</p>
        )}

        <p className="mt-4 text-xs text-gray-600">
          Demo mode uses cached AI responses — no API key required
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-gray-800">
        <h2 className="text-2xl font-semibold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Ingest signals',
              desc: 'Paste or upload support tickets, sales call notes, and product reviews from any source.',
            },
            {
              step: '02',
              title: 'Analyze & cluster',
              desc: 'Signals are embedded and clustered into themes. Each theme is scored by frequency, recency, segment, and cross-source coverage.',
            },
            {
              step: '03',
              title: 'Get your roadmap',
              desc: 'GPT-4o generates a prioritized roadmap with PM-quality rationale and verbatim evidence for each item.',
            },
          ].map((item) => (
            <div key={item.step} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="text-indigo-400 font-mono text-sm mb-3">{item.step}</div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center border-t border-gray-800">
        <p className="text-sm text-gray-500 mb-4">Built with</p>
        <div className="flex flex-wrap justify-center gap-3">
          {['Next.js 14', 'FastAPI', 'OpenAI GPT-4o', 'text-embedding-3-small', 'KMeans', 'SQLite', 'Recharts', 'TypeScript'].map((tech) => (
            <span key={tech} className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300 border border-gray-700">
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-600 border-t border-gray-800">
        <a
          href="https://github.com/Poojaahegde/signal-to-roadmap"
          className="hover:text-gray-400 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub — Poojaahegde/signal-to-roadmap
        </a>
        {' · '}
        <span>MIT License</span>
      </footer>
    </main>
  );
}
