import { useState } from 'react';
import { Gift, Play, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RewardedAdProps {
  triggerOnAction?: boolean;
  actionCount?: number;
}

export function useRewardedAd({ triggerOnAction = true, actionCount = 3 }: RewardedAdProps = {}) {
  const [showDialog, setShowDialog] = useState(false);
  const [actions, setActions] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);

  const triggerAd = () => {
    if (triggerOnAction) {
      setActions(prev => {
        const newCount = prev + 1;
        if (newCount >= actionCount) {
          setShowDialog(true);
          return 0;
        }
        return newCount;
      });
    } else {
      setShowDialog(true);
    }
  };

  const watchAd = () => {
    setIsWatching(true);
    // Simulate ad watching (30 seconds)
    setTimeout(() => {
      setIsWatching(false);
      setRewardEarned(true);
      setTimeout(() => {
        setShowDialog(false);
        setRewardEarned(false);
      }, 2000);
    }, 3000); // Shortened for demo
  };

  const RewardDialog = () => (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Gift className="w-6 h-6 text-yellow-500" />
            Watch & Earn
          </DialogTitle>
        </DialogHeader>

        <div className="text-center py-4">
          {!isWatching && !rewardEarned && (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
              <p className="text-gray-300 mb-2">
                Watch a short video to unlock:
              </p>
              <ul className="text-left text-sm text-gray-400 space-y-1 mb-4 max-w-[200px] mx-auto">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Unlimited photo storage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Remove ads for 1 hour
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Premium features
                </li>
              </ul>
              <div className="flex gap-3">
                <Button 
                  onClick={watchAd}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Watch Ad
                </Button>
                <Button 
                  onClick={() => setShowDialog(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {isWatching && (
            <div className="py-8">
              <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-yellow-500 font-medium">Watching ad...</p>
              <p className="text-gray-500 text-sm mt-2">Please wait</p>
            </div>
          )}

          {rewardEarned && (
            <div className="py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <p className="text-green-500 font-medium text-lg">Reward Earned!</p>
              <p className="text-gray-400 text-sm mt-2">Enjoy your premium features</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return { triggerAd, RewardDialog, actions };
}

// Interstitial Ad Hook
export function useInterstitialAd() {
  const [showAd, setShowAd] = useState(false);

  const showInterstitial = () => {
    setShowAd(true);
    setTimeout(() => setShowAd(false), 5000); // 5 second ad
  };

  const InterstitialAd = () => {
    if (!showAd) return null;

    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="w-full max-w-md p-4">
          {/* Mock Interstitial Ad */}
          <div className="bg-gray-900 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-white text-xl font-bold">Premium Vault</h3>
                <p className="text-white/80 text-sm mt-2">Unlock all features today!</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Ad • 5s</span>
                <button 
                  onClick={() => setShowAd(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AdMob Interstitial Placeholder */}
        {/*
          TODO: Replace with actual AdMob Interstitial:
          
          import { InterstitialAd } from '@react-native-admob/admob';
          
          const interstitial = InterstitialAd.createForAdRequest(
            'ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwww'
          );
          
          interstitial.load();
          interstitial.show();
        */}
      </div>
    );
  };

  return { showInterstitial, InterstitialAd };
}
