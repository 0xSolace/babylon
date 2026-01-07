import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { EligibilityResponse, MintFlowState } from '@/types/nft';

interface MintedNft {
  tokenId: number;
  name: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  storyTitle: string | null;
}

interface UseNftMintResult {
  eligibility: EligibilityResponse | null;
  isCheckingEligibility: boolean;
  isMinting: boolean;
  flowState: MintFlowState;
  mintedNft: MintedNft | null;
  error: string | null;
  checkEligibility: () => Promise<void>;
  startMint: () => Promise<void>;
  resetFlow: () => void;
}

export function useNftMint(): UseNftMintResult {
  const { authenticated, getAccessToken } = useAuth();
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(
    null
  );
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [flowState, setFlowState] = useState<MintFlowState>('idle');
  const [mintedNft, setMintedNft] = useState<MintedNft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!authenticated) {
      setEligibility({
        eligible: false,
        status: 'not_authenticated',
        hasMinted: false,
      });
      return;
    }

    setIsCheckingEligibility(true);
    setFlowState('checking_eligibility');
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setEligibility({
          eligible: false,
          status: 'not_authenticated',
          hasMinted: false,
        });
        setFlowState('idle');
        return;
      }

      const res = await fetch('/api/nft/eligibility', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError((await res.json()).error ?? 'Failed to check eligibility');
        setFlowState('error');
        return;
      }

      const data: EligibilityResponse = await res.json();
      setEligibility(data);

      // Populate mintedNft if already claimed
      if (data.mintedNft) {
        setMintedNft({
          tokenId: data.mintedNft.tokenId,
          name: data.mintedNft.name,
          imageUrl: data.mintedNft.thumbnailUrl,
          thumbnailUrl: data.mintedNft.thumbnailUrl,
          storyTitle: null,
        });
      }

      setFlowState(data.eligible ? 'eligible' : 'idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setFlowState('error');
    } finally {
      setIsCheckingEligibility(false);
    }
  }, [authenticated, getAccessToken]);

  /** Claim the pre-assigned NFT */
  const startMint = useCallback(async () => {
    if (!authenticated) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!eligibility?.eligible || eligibility.hasMinted) {
      toast.error('You are not eligible to claim');
      return;
    }

    setFlowState('minting');
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Authentication failed');
        setFlowState('error');
        return;
      }

      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const msg = (await res.json()).error ?? 'Failed to claim NFT';
        setError(msg);
        toast.error(msg);
        setFlowState('error');
        return;
      }

      const { nft, txHash, message } = await res.json();

      setMintedNft({
        tokenId: nft.tokenId,
        name: nft.name,
        imageUrl: nft.imageUrl,
        thumbnailUrl: nft.thumbnailUrl,
        storyTitle: null,
      });
      setFlowState('revealing');
      setEligibility((prev) =>
        prev
          ? {
              ...prev,
              hasMinted: true,
              status: 'already_minted',
              mintedNft: {
                tokenId: nft.tokenId,
                name: nft.name,
                thumbnailUrl: nft.thumbnailUrl,
                txHash,
              },
            }
          : null
      );
      toast.success(message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      toast.error(msg);
      setFlowState('error');
    }
  }, [authenticated, eligibility, getAccessToken]);

  const resetFlow = useCallback(() => {
    setFlowState(eligibility?.hasMinted ? 'complete' : 'eligible');
    setError(null);
  }, [eligibility?.hasMinted]);

  useEffect(() => {
    if (authenticated) {
      checkEligibility();
    } else {
      setEligibility(null);
      setFlowState('idle');
    }
  }, [authenticated, checkEligibility]);

  return {
    eligibility,
    isCheckingEligibility,
    isMinting: flowState === 'minting',
    flowState,
    mintedNft,
    error,
    checkEligibility,
    startMint,
    resetFlow,
  };
}
