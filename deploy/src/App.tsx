import { useState, useEffect, useRef } from 'react';
import { Calculator, Lock, Unlock, ImagePlus, Trash2, ArrowLeft, KeyRound, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BannerAd } from '@/components/ads/BannerAd';
import { NativeAd } from '@/components/ads/NativeAd';
import { useRewardedAd, useInterstitialAd } from '@/components/ads/RewardedAd';
import './App.css';

type View = 'calculator' | 'pin' | 'vault' | 'setup-pin';

interface Photo {
  id: string;
  data: string;
  name: string;
  date: number;
}

function App() {
  const [view, setView] = useState<View>('calculator');
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPremiumBanner, setShowPremiumBanner] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ad hooks
  const { triggerAd: triggerRewardedAd, RewardDialog } = useRewardedAd({ 
    triggerOnAction: true, 
    actionCount: 3 
  });
  const { showInterstitial, InterstitialAd } = useInterstitialAd();

  // Load stored data on mount
  useEffect(() => {
    const savedPin = localStorage.getItem('vault_pin');
    const savedPhotos = localStorage.getItem('vault_photos');
    if (savedPin) setStoredPin(savedPin);
    if (savedPhotos) {
      try {
        setPhotos(JSON.parse(savedPhotos));
      } catch (e) {
        console.error('Failed to parse photos:', e);
      }
    }
  }, []);

  // Save photos when changed
  useEffect(() => {
    localStorage.setItem('vault_photos', JSON.stringify(photos));
  }, [photos]);

  // Calculator functions
  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputOperation = (op: string) => {
    const inputValue = parseFloat(display);
    
    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);
      setPreviousValue(newValue);
      setDisplay(String(newValue));
    }
    
    setWaitingForOperand(true);
    setOperation(op);
  };

  const calculate = (first: number, second: number, op: string): number => {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '×': return first * second;
      case '÷': return second !== 0 ? first / second : 0;
      default: return second;
    }
  };

  const performCalculation = () => {
    const inputValue = parseFloat(display);
    
    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  // Secret vault access
  const handleEqualsLongPress = () => {
    // Show interstitial ad before entering vault (30% chance)
    if (Math.random() < 0.3) {
      showInterstitial();
    }
    
    if (storedPin) {
      setView('pin');
      setPin('');
    } else {
      setView('setup-pin');
      setNewPin('');
      setConfirmPin('');
    }
  };

  // PIN verification
  const verifyPin = () => {
    if (pin === storedPin) {
      setView('vault');
      setPin('');
      toast.success('Vault unlocked!');
    } else {
      toast.error('Wrong PIN!');
      setPin('');
    }
  };

  // Setup new PIN
  const setupPin = () => {
    if (newPin.length < 4) {
      toast.error('PIN must be at least 4 digits!');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match!');
      return;
    }
    localStorage.setItem('vault_pin', newPin);
    setStoredPin(newPin);
    setView('vault');
    toast.success('PIN set successfully!');
  };

  // Photo handling
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file!');
      return;
    }

    // Trigger rewarded ad every 3 photo uploads
    triggerRewardedAd();

    const reader = new FileReader();
    reader.onload = (event) => {
      const newPhoto: Photo = {
        id: Date.now().toString(),
        data: event.target?.result as string,
        name: file.name,
        date: Date.now(),
      };
      setPhotos([...photos, newPhoto]);
      toast.success('Photo saved to vault!');
    };
    reader.readAsDataURL(file);
  };

  const deletePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
    toast.success('Photo deleted!');
  };

  const changePin = () => {
    setView('setup-pin');
    setNewPin('');
    setConfirmPin('');
  };

  // Calculator button component
  const CalcButton = ({ 
    label, 
    onClick, 
    onContextMenu,
    variant = 'default',
    className = ''
  }: { 
    label: string | React.ReactNode; 
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    variant?: 'default' | 'primary' | 'secondary' | 'accent';
    className?: string;
  }) => {
    const baseStyles = 'h-14 sm:h-16 text-lg sm:text-xl font-semibold rounded-2xl transition-all active:scale-95';
    const variants = {
      default: 'bg-gray-800 text-white hover:bg-gray-700',
      primary: 'bg-orange-500 text-white hover:bg-orange-600',
      secondary: 'bg-gray-600 text-white hover:bg-gray-500',
      accent: 'bg-blue-600 text-white hover:bg-blue-700',
    };
    
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`${baseStyles} ${variants[variant]} ${className}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-2 sm:p-4">
      <InterstitialAd />
      <RewardDialog />
      
      <div className="w-full max-w-md">
        
        {/* CALCULATOR VIEW */}
        {view === 'calculator' && (
          <div className="bg-gray-900 rounded-3xl p-4 sm:p-6 shadow-2xl">
            {/* Premium Upgrade Banner */}
            {showPremiumBanner && (
              <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/30 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-yellow-500 text-sm font-medium">Go Premium</p>
                      <p className="text-gray-400 text-xs">Remove all ads forever!</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPremiumBanner(false)}
                    className="text-gray-500 hover:text-gray-400"
                  >
                    <span className="text-xs">✕</span>
                  </button>
                </div>
              </div>
            )}

            {/* Top Banner Ad */}
            <BannerAd size="small" position="top" />

            {/* Display */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4 mt-3">
              <div className="text-right text-3xl sm:text-4xl font-mono text-white overflow-hidden">
                {display}
              </div>
              {operation && (
                <div className="text-right text-gray-400 text-sm mt-1">
                  {previousValue} {operation}
                </div>
              )}
            </div>

            {/* Buttons Grid */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <CalcButton label="C" onClick={clear} variant="secondary" />
              <CalcButton label="⌫" onClick={backspace} variant="secondary" />
              <CalcButton label="÷" onClick={() => inputOperation('÷')} variant="primary" />
              <CalcButton label="×" onClick={() => inputOperation('×')} variant="primary" />

              <CalcButton label="7" onClick={() => inputNumber('7')} />
              <CalcButton label="8" onClick={() => inputNumber('8')} />
              <CalcButton label="9" onClick={() => inputNumber('9')} />
              <CalcButton label="-" onClick={() => inputOperation('-')} variant="primary" />

              <CalcButton label="4" onClick={() => inputNumber('4')} />
              <CalcButton label="5" onClick={() => inputNumber('5')} />
              <CalcButton label="6" onClick={() => inputNumber('6')} />
              <CalcButton label="+" onClick={() => inputOperation('+')} variant="primary" />

              <CalcButton label="1" onClick={() => inputNumber('1')} />
              <CalcButton label="2" onClick={() => inputNumber('2')} />
              <CalcButton label="3" onClick={() => inputNumber('3')} />
              <CalcButton 
                label="=" 
                onClick={performCalculation}
                onContextMenu={(e: React.MouseEvent) => {
                  e.preventDefault();
                  handleEqualsLongPress();
                }}
                variant="accent" 
                className="row-span-2 h-full"
              />

              <CalcButton label="0" onClick={() => inputNumber('0')} className="col-span-2" />
              <CalcButton label="." onClick={() => inputNumber('.')} />
            </div>

            {/* Bottom Banner Ad */}
            <BannerAd size="medium" position="bottom" />

            {/* Secret hint */}
            <p className="text-center text-gray-600 text-xs mt-2">
              Long press = button for vault
            </p>
          </div>
        )}

        {/* PIN ENTRY VIEW */}
        {view === 'pin' && (
          <div className="bg-gray-900 rounded-3xl p-4 sm:p-6 shadow-2xl">
            {/* Top Banner Ad */}
            <BannerAd size="small" position="top" />

            <div className="text-center mb-6 mt-3">
              <Lock className="w-14 h-14 sm:w-16 sm:h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Enter PIN</h2>
              <p className="text-gray-400 text-sm">Access your secret vault</p>
            </div>

            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter PIN"
              className="text-center text-2xl tracking-widest bg-gray-800 border-gray-700 text-white mb-4"
              maxLength={6}
            />

            <Button 
              onClick={verifyPin}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
            >
              <Unlock className="w-5 h-5 mr-2" />
              Unlock
            </Button>

            <Button 
              onClick={() => setView('calculator')}
              variant="ghost"
              className="w-full mt-4 text-gray-400"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Calculator
            </Button>

            {/* Bottom Banner Ad */}
            <BannerAd size="medium" position="bottom" />
          </div>
        )}

        {/* SETUP PIN VIEW */}
        {view === 'setup-pin' && (
          <div className="bg-gray-900 rounded-3xl p-4 sm:p-6 shadow-2xl">
            {/* Top Banner Ad */}
            <BannerAd size="small" position="top" />

            <div className="text-center mb-6 mt-3">
              <KeyRound className="w-14 h-14 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Set Up PIN</h2>
              <p className="text-gray-400 text-sm">Create a PIN for your vault</p>
            </div>

            <Input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="New PIN (4-6 digits)"
              className="text-center text-2xl tracking-widest bg-gray-800 border-gray-700 text-white mb-4"
              maxLength={6}
            />

            <Input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Confirm PIN"
              className="text-center text-2xl tracking-widest bg-gray-800 border-gray-700 text-white mb-4"
              maxLength={6}
            />

            <Button 
              onClick={setupPin}
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
            >
              Set PIN
            </Button>

            <Button 
              onClick={() => setView('calculator')}
              variant="ghost"
              className="w-full mt-4 text-gray-400"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>

            {/* Bottom Banner Ad */}
            <BannerAd size="medium" position="bottom" />
          </div>
        )}

        {/* VAULT VIEW */}
        {view === 'vault' && (
          <div className="bg-gray-900 rounded-3xl p-4 sm:p-6 shadow-2xl min-h-[600px]">
            {/* Top Banner Ad */}
            <BannerAd size="small" position="top" />

            <div className="flex items-center justify-between mb-4 mt-3">
              <div className="flex items-center">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-2" />
                <h2 className="text-lg sm:text-xl font-bold text-white">Secret Vault</h2>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={changePin}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400"
                >
                  <KeyRound className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => setView('calculator')}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400"
                >
                  <Calculator className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Native Ad in Vault */}
            <NativeAd />

            {/* Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mb-4 bg-blue-600 hover:bg-blue-700 h-12 sm:h-14"
            >
              <ImagePlus className="w-5 h-5 mr-2" />
              Add Photo to Vault
            </Button>

            {/* Mid-content Banner Ad */}
            <BannerAd size="medium" position="bottom" />

            {/* Photos Grid */}
            {photos.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <ImagePlus className="w-14 h-14 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No photos in vault yet</p>
                <p className="text-gray-500 text-sm">Tap above to add photos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.data}
                      alt={photo.name}
                      className="w-full h-28 sm:h-32 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Banner Ad */}
            <BannerAd size="large" position="bottom" />

            <p className="text-center text-gray-600 text-xs mt-4">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} stored securely
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
