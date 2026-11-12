'use client';

import dynamic from 'next/dynamic';

const TalentMatchApp = dynamic(() => import('../src/App'), { ssr: false });

export default function HomePage() {
  return <TalentMatchApp />;
}
