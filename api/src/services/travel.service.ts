import { prisma } from '../config/database'

// ── Country name lookup (ISO 3166-1 alpha-2) ──────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  MZ: 'Mozambique',  ZA: 'South Africa', BR: 'Brazil',       PT: 'Portugal',
  AO: 'Angola',      CV: 'Cape Verde',   ST: 'São Tomé',     GW: 'Guinea-Bissau',
  MO: 'Macau',       TL: 'Timor-Leste',  US: 'United States',GB: 'United Kingdom',
  FR: 'France',      DE: 'Germany',      ES: 'Spain',         IT: 'Italy',
  NL: 'Netherlands', BE: 'Belgium',      CH: 'Switzerland',   SE: 'Sweden',
  NO: 'Norway',      DK: 'Denmark',      FI: 'Finland',       PL: 'Poland',
  RU: 'Russia',      CN: 'China',        JP: 'Japan',         KR: 'South Korea',
  IN: 'India',       AU: 'Australia',    NZ: 'New Zealand',   CA: 'Canada',
  MX: 'Mexico',      AR: 'Argentina',    CL: 'Chile',         CO: 'Colombia',
  PE: 'Peru',        VE: 'Venezuela',    NG: 'Nigeria',       GH: 'Ghana',
  KE: 'Kenya',       ET: 'Ethiopia',     TZ: 'Tanzania',      UG: 'Uganda',
  EG: 'Egypt',       MA: 'Morocco',      ZW: 'Zimbabwe',      ZM: 'Zambia',
  SN: 'Senegal',     CI: "Côte d'Ivoire",CM: 'Cameroon',     SG: 'Singapore',
  TH: 'Thailand',    ID: 'Indonesia',    MY: 'Malaysia',      PH: 'Philippines',
  VN: 'Vietnam',     TR: 'Turkey',       SA: 'Saudi Arabia',  AE: 'UAE',
  IL: 'Israel',
}

function resolveCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

// ── interact ──────────────────────────────────────────────────────────────────
// Called fire-and-forget from existing interaction handlers.
// Uses upsert+increment — atomic in PostgreSQL, safe under concurrency.
export async function interact(
  postId:  string,
  userId:  string,
  type:    'view' | 'like' | 'comment',
): Promise<void> {
  // Verify post has travel enabled; silently skip if not
  const post = await prisma.post.findUnique({
    where:  { id: postId },
    select: { isTravelEnabled: true },
  })
  if (!post?.isTravelEnabled) return

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { countryCode: true },
  })
  if (!user?.countryCode) return

  const countryCode = user.countryCode.toUpperCase()
  const countryName = resolveCountryName(countryCode)

  const increment = {
    views:    type === 'view'    ? 1 : 0,
    likes:    type === 'like'    ? 1 : 0,
    comments: type === 'comment' ? 1 : 0,
  }

  await prisma.travelNode.upsert({
    where:  { postId_countryCode: { postId, countryCode } },
    create: { postId, countryCode, countryName, ...increment },
    update: {
      views:              { increment: increment.views },
      likes:              { increment: increment.likes },
      comments:           { increment: increment.comments },
      lastInteractionAt:  new Date(),
    },
  })
}

// ── addObject ─────────────────────────────────────────────────────────────────
export async function addObject(
  postId:  string,
  userId:  string,
  type:    string,
  value:   string,
): Promise<{ id: string; value: string; type: string; countryCode: string; user: { id: string; name: string; avatar: string | null } }> {
  const [post, user] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId }, select: { isTravelEnabled: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true, name: true, avatar: true } }),
  ])

  if (!post?.isTravelEnabled) throw new Error('Travel not enabled on this post')
  if (!user)                   throw new Error('User not found')

  const countryCode = (user.countryCode ?? 'XX').toUpperCase()

  const obj = await prisma.travelObject.create({
    data: { postId, userId, type, value, countryCode },
    select: { id: true, value: true, type: true, countryCode: true,
              user: { select: { id: true, name: true, avatar: true } } },
  })

  // Increment objectsAdded on the node (fire-and-forget)
  prisma.travelNode.upsert({
    where:  { postId_countryCode: { postId, countryCode } },
    create: { postId, countryCode, countryName: resolveCountryName(countryCode), objectsAdded: 1 },
    update: { objectsAdded: { increment: 1 }, lastInteractionAt: new Date() },
  }).catch(() => {})

  return obj
}

// ── removeObject ──────────────────────────────────────────────────────────────
// Only post owner OR the object's creator can remove
export async function removeObject(objectId: string, requesterId: string): Promise<void> {
  const obj = await prisma.travelObject.findUnique({
    where:  { id: objectId },
    select: { userId: true, postId: true, post: { select: { userId: true } } },
  })
  if (!obj) throw new Error('Object not found')

  const isObjectOwner = obj.userId    === requesterId
  const isPostOwner   = obj.post.userId === requesterId
  if (!isObjectOwner && !isPostOwner) throw new Error('Forbidden')

  await prisma.travelObject.delete({ where: { id: objectId } })
}

// ── getTravelData ─────────────────────────────────────────────────────────────
export async function getTravelData(postId: string) {
  const [nodes, objects] = await Promise.all([
    prisma.travelNode.findMany({
      where:   { postId },
      orderBy: { firstInteractionAt: 'asc' },
    }),
    prisma.travelObject.findMany({
      where:   { postId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, type: true, value: true, countryCode: true, createdAt: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    }),
  ])

  const totalViews    = nodes.reduce((s, n) => s + n.views,       0)
  const totalLikes    = nodes.reduce((s, n) => s + n.likes,       0)
  const totalComments = nodes.reduce((s, n) => s + n.comments,    0)
  const totalObjects  = nodes.reduce((s, n) => s + n.objectsAdded, 0)

  const mostActive = nodes.length
    ? nodes.reduce((a, b) => (a.views + a.likes + a.comments) >= (b.views + b.likes + b.comments) ? a : b)
    : null

  const lastNode = nodes.length ? nodes[nodes.length - 1] : null

  return {
    nodes,
    objects,
    stats: {
      totalCountries:    nodes.length,
      totalViews,
      totalLikes,
      totalComments,
      totalObjects,
      lastCountry:       lastNode   ? { code: lastNode.countryCode,   name: lastNode.countryName }   : null,
      mostActiveCountry: mostActive ? { code: mostActive.countryCode, name: mostActive.countryName } : null,
    },
  }
}
