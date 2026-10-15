import { LeagueDetailPage } from '@/components/freebet/social-pages'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LeagueDetailPage id={id} />
}
