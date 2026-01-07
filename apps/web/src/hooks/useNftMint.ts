import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type {
  EligibilityResponse,
  MintConfirmResponse,
  MintFlowState,
} from '@/types/nft';

const MINTING_STATES: MintFlowState[] = [
  'preparing',
  'awaiting_signature',
  'minting',
  'confirming',
];

interface ClaimResponse {
  success: boolean;
  tokenId: number;
  nft: {
    tokenId: number;
    name: string;
    description: string | null;
    imageUrl: string;
    thumbnailUrl: string;
  };
  txHash: string;
  message: string;
}

interface UseNftMintResult {
  eligibility: EligibilityResponse | null;
  isCheckingEligibility: boolean;
  isMinting: boolean;
  flowState: MintFlowState;
  mintedNft: MintConfirmResponse['nft'] | null;
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
  const [mintedNft, setMintedNft] = useState<MintConfirmResponse['nft'] | null>(
    null
  );
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

    const token = await getAccessToken();
    if (!token) {
      setEligibility({
        eligible: false,
        status: 'not_authenticated',
        hasMinted: false,
      });
      setFlowState('idle');
      setIsCheckingEligibility(false);
      return;
    }

    const response = await fetch('/api/nft/eligibility', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.error ?? 'Failed to check eligibility');
      setFlowState('error');
      setIsCheckingEligibility(false);
      return;
    }

    const data: EligibilityResponse = await response.json();
    setEligibility(data);

    if (data.status === 'already_minted' && data.mintedNft) {
      setMintedNft({
        tokenId: data.mintedNft.tokenId,
        name: data.mintedNft.name,
        imageUrl: data.mintedNft.thumbnailUrl,
        thumbnailUrl: data.mintedNft.thumbnailUrl,
        storyTitle: null,
      });
    }

    setFlowState(data.eligible ? 'eligible' : 'idle');
    setIsCheckingEligibility(false);
  }, [authenticated, getAccessToken]);

  /**
   * Start the claim process using the simulated claim API
   * This will claim the pre-assigned NFT for the user
   */
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

    const token = await getAccessToken();
    if (!token) {
      toast.error('Authentication failed');
      setFlowState('error');
      return;
    }

    // Call the simulated claim API
    const claimResponse = await fetch('/api/nft/claim', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!claimResponse.ok) {
      const errorData = await claimResponse.json();
      const errorMessage = errorData.error ?? 'Failed to claim NFT';
      setError(errorMessage);
      toast.error(errorMessage);
      setFlowState('error');
      return;
    }

    const claimData: ClaimResponse = await claimResponse.json();

    // Set minted NFT for reveal modal
    setMintedNft({
      tokenId: claimData.nft.tokenId,
      name: claimData.nft.name,
      imageUrl: claimData.nft.imageUrl,
      thumbnailUrl: claimData.nft.thumbnailUrl,
      storyTitle: null,
    });

    setFlowState('revealing');

    // Update eligibility state
    setEligibility((prev) =>
      prev
        ? {
            ...prev,
            hasMinted: true,
            status: 'already_minted',
            mintedNft: {
              tokenId: claimData.nft.tokenId,
              name: claimData.nft.name,
              thumbnailUrl: claimData.nft.thumbnailUrl,
              txHash: claimData.txHash,
            },
          }
        : null
    );

    toast.success(claimData.message);
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

  const isMinting = MINTING_STATES.includes(flowState);

  return {
    eligibility,
    isCheckingEligibility,
    isMinting,
    flowState,
    mintedNft,
    error,
    checkEligibility,
    startMint,
    resetFlow,
  };
}
