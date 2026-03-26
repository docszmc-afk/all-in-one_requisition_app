import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../context/AuthContext';
import { Lock, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClear?: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
  const { user, verifyPassword } = useAuth();
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mode, setMode] = useState<'draw' | 'password'>('draw');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
    setPassword('');
    setError('');
    if (onClear) onClear();
  };

  const handleEnd = () => {
    setIsEmpty(sigCanvas.current?.isEmpty() ?? true);
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      onSave(sigCanvas.current.getCanvas().toDataURL('image/png'));
    }
  };

  const generateStamp = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw border
    ctx.strokeStyle = '#ea580c'; // orange-600
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 380, 130);

    // Draw text
    ctx.fillStyle = '#ea580c';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIGITALLY SIGNED BY', 200, 50);
    
    ctx.fillStyle = '#1c1917'; // stone-900
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(user?.email || 'User', 200, 90);

    ctx.fillStyle = '#78716c'; // stone-500
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(new Date().toLocaleString(), 200, 120);

    return canvas.toDataURL('image/png');
  };

  const handlePasswordSign = () => {
    setError('');
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (verifyPassword(password)) {
      const stampDataUrl = generateStamp();
      onSave(stampDataUrl);
      setPassword('');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex space-x-4 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`flex items-center text-sm font-medium pb-2 -mb-[9px] border-b-2 transition-colors ${
            mode === 'draw' ? 'border-orange-600 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <PenTool className="w-4 h-4 mr-2" />
          Draw Signature
        </button>
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex items-center text-sm font-medium pb-2 -mb-[9px] border-b-2 transition-colors ${
            mode === 'password' ? 'border-orange-600 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Lock className="w-4 h-4 mr-2" />
          Sign with Password
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="flex flex-col space-y-2">
          <div className="border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 overflow-hidden">
            <SignatureCanvas
              ref={sigCanvas}
              onEnd={handleEnd}
              penColor="black"
              canvasProps={{
                className: 'w-full h-40 cursor-crosshair',
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500">Sign above</span>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear Signature
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-4 bg-stone-50 p-6 rounded-xl border border-stone-200">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Enter Password to Sign
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border-stone-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
              placeholder="Your account password"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-500">This will generate a digital stamp</span>
            <button
              type="button"
              onClick={handlePasswordSign}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              Apply Stamp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
