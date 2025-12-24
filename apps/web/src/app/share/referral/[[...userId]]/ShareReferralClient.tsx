/**
 * Client-side shareable referral page
 * Fetches referral code and redirects to home with ref param
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'
import { getApiBaseUrl, isBrowser } from '@/config'
import { useRouter } from '@/lib/navigation'

interface ReferralCodeResponse {
  referralCode: string | null
}

async function fetchReferralCode(
  userId: string,
): Promise<ReferralCodeResponse> {
  const apiBaseUrl = isBrowser()
    ? `${window.location.origin}/api`
    : getApiBaseUrl()

  const response = await fetch(
    `${apiBaseUrl}/users/${encodeURIComponent(userId)}/referral-code`,
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch referral code: ${response.status}`)
  }

  return response.json() as Promise<ReferralCodeResponse>
}

export default function ShareReferralClient() {
  const params = useParams()
  const router = useRouter()
  // Catch-all route: params.userId is string[] or undefined
  const userIdParam = params.userId
  const rawUserId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam
  const userId = rawUserId ? decodeURIComponent(rawUserId) : null

  const { data, isSuccess, isError } = useQuery({
    queryKey: ['referralCode', userId],
    queryFn: () => fetchReferralCode(userId),
    enabled: !!userId,
    retry: false,
    staleTime: 0,
  })

  // Handle redirect based on query result
  useEffect(() => {
    if (!userId) {
      router.replace('/')
      return
    }

    if (isSuccess && data?.referralCode) {
      router.replace(`/?ref=${data.referralCode}`)
    } else if (isSuccess && !data?.referralCode) {
      router.replace('/')
    } else if (isError) {
      router.replace('/')
    }
  }, [userId, isSuccess, isError, data, router])

  // Don't render with missing userId - redirect will happen via useEffect
  if (!userId) {
    return null
  }

  return (
    <PageContainer>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-center">
          <Skeleton className="mx-auto mb-4 h-16 w-16 rounded-full" />
          <h1 className="mb-2 font-bold text-xl">Redirecting...</h1>
          <p className="text-muted-foreground">
            Taking you to your referral link
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
