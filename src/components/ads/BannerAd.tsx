import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface BannerAdProps {
  size?: 'small' | 'medium' | 'large';
  position?: 'top' | 'bottom';
  onClose?: () => void;
  closable?: boolean;
}

export function BannerAd({ 
  size = 'medium', 
  position = 'bottom',
  onClose,
  closable = true 
}: BannerAdProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate ad loading
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const heights = {
    small: 'h-12',
    medium: 'h-16',
    large: 'h-20'
  };

  const widths = {
    small: 'w-full max-w-xs',
    medium: 'w-full max-w-sm',
    large: 'w-full max-w-md'
  };

  return (
    <div className={`relative ${position === 'top' ? 'mb-3' : 'mt-3'}`}>
      {/* Ad Label */}
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Sponsored
        </span>
        {closable && (
          <button 
            onClick={() => {
              setIsVisible(false);
              onClose?.();
            }}
            className="text-gray-500 hover:text-gray-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Ad Container - Replace with actual AdMob banner code */}
      <div 
        className={`
          ${heights[size]} 
          ${widths[size]} 
          mx-auto 
          bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-pink-900/40
          border border-gray-700/50
          rounded-xl
          flex items-center justify-center
          overflow-hidden
          relative
        `}
      >
        {!isLoaded ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs">Loading ad...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 w-full">
            {/* Mock Ad Content - Replace with real AdMob */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">Premium App Upgrade</p>
              <p className="text-gray-400 text-xs truncate">Remove ads & unlock features!</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-full transition-colors flex-shrink-0">
              Install
            </button>
          </div>
        )}

        {/* AdMob Integration Placeholder */}
        {/* 
          TODO: Replace above content with actual AdMob code:
          
          For React with AdMob:
          import { BannerAd as AdMobBanner, BannerAdSize } from '@react-native-admob/admob';
          
          <AdMobBanner
            size={BannerAdSize.BANNER}
            unitId="ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy"
            onAdFailedToLoad={(error) => console.error(error)}
          />
        */}
      </div>
    </div>
  );
}
