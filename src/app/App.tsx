import { useState } from 'react';
import { KiteViewer } from './components/KiteViewer';
import { LandingPage, KiteType } from './components/LandingPage';

export default function App() {
  const [screen,   setScreen]   = useState<'landing' | 'designer'>('landing');
  const [kiteType, setKiteType] = useState<KiteType>('classic');

  const handleStart = (type: KiteType) => {
    setKiteType(type);
    setScreen('designer');
  };

  if (screen === 'landing') {
    return <LandingPage onStart={handleStart} />;
  }

  return (
    <div className="size-full flex items-center justify-center">
      <KiteViewer kiteType={kiteType} />
    </div>
  );
}
