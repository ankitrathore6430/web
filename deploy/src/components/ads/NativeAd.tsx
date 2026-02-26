import { useEffect, useState } from 'react';
import { Star, Download, X } from 'lucide-react';

interface NativeAdProps {
  onClose?: () => void;
}

export function NativeAd({ onClose }: NativeAdProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="bg-gray-800/80 rounded-2xl p-4 mb-4 border border-gray-700/50">
      {/* Ad Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-700/50 px-2 py-0.5 rounded">
          Ad
        </span>
        <button 
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="text-gray-500 hover:text-gray-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Native Ad Content */}
      {!isLoaded ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4">
          {/* App Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Star className="w-8 h-8 text-white" />
          </div>

          {/* Ad Details */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm mb-1 truncate">
              Photo Vault Pro
            </h4>
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              ))}
              <span className="text-gray-400 text-xs ml-1">4.9</span>
            </div>
            <p className="text-gray-400 text-xs line-clamp-2 mb-2">
              Hide photos & videos securely. Advanced encryption with cloud backup.
            </p>
            <button className="bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
              <Download className="w-3 h-3" />
              Free Install
            </button>
          </div>
        </div>
      )}

      {/* AdMob Native Ad Integration Placeholder */}
      {/*
        TODO: Replace with actual AdMob Native Ad:
        
        import { NativeAdView } from '@react-native-admob/admob';
        
        <NativeAdView
          unitId="ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz"
          style={{ width: '100%', height: 150 }}
        >
          <NativeAdComponents />
        </NativeAdView>
      */}
    </div>
  );
}
