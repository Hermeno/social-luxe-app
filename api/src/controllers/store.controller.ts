import { Request, Response } from 'express'
import { prisma } from '../config/database'

function ok(res: Response, data: unknown) {
  return res.json({ success: true, data })
}

export async function getProducts(req: Request, res: Response) {
  try {
    const { category, q, limit = '30', cursor } = req.query as Record<string, string>
    const take = Math.min(Number(limit) || 30, 100)

    const where: any = { status: 'active' }
    if (category) where.category = category
    if (q) {
      where.OR = [
        { title:       { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags:        { has: q } },
      ]
    }
    if (cursor) where.createdAt = { lt: new Date(cursor) }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        seller: { select: { id: true, name: true, avatar: true, isAdmin: true } },
        saves_by: { where: { userId: (req as any).userId }, select: { id: true } },
      },
    })

    return ok(res, products.map(p => ({
      ...p,
      sellerName:     p.seller.name,
      sellerAvatar:   p.seller.avatar,
      sellerVerified: p.seller.isAdmin,
      isSaved:        p.saves_by.length > 0,
      seller:         undefined,
      saves_by:       undefined,
    })))
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const p = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true, avatar: true, isAdmin: true } },
        saves_by: { where: { userId }, select: { id: true } },
      },
    })
    if (!p) return res.status(404).json({ success: false, message: 'Not found' })

    // Increment view count (fire and forget)
    prisma.product.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {})

    return ok(res, {
      ...p,
      sellerName:     p.seller.name,
      sellerAvatar:   p.seller.avatar,
      sellerVerified: p.seller.isAdmin,
      isSaved:        p.saves_by.length > 0,
      seller:         undefined,
      saves_by:       undefined,
    })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function getProductsBySeller(req: Request, res: Response) {
  try {
    const { sellerId } = req.params
    const userId = (req as any).userId

    const products = await prisma.product.findMany({
      where: { sellerId, status: { in: ['active', 'paused'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, name: true, avatar: true, isAdmin: true } },
        saves_by: { where: { userId }, select: { id: true } },
      },
    })

    return ok(res, products.map(p => ({
      ...p,
      sellerName:     p.seller.name,
      sellerAvatar:   p.seller.avatar,
      sellerVerified: p.seller.isAdmin,
      isSaved:        p.saves_by.length > 0,
      seller:         undefined,
      saves_by:       undefined,
    })))
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    const userId = (req as any).userId
    const {
      title, description, price, currency = 'MZN', category, type,
      images = [], quantity = 1, city, country, hasShipping = false,
      shippingPrice, tags = [],
    } = req.body

    if (!title || !description || !price || !category || !type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' })
    }

    const seller = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true, isAdmin: true } })
    if (!seller) return res.status(404).json({ success: false, message: 'User not found' })

    const product = await prisma.product.create({
      data: {
        sellerId: userId,
        title, description,
        price: Number(price),
        currency,
        category,
        type,
        images,
        quantity: Number(quantity),
        city, country,
        hasShipping,
        shippingPrice: shippingPrice ? Number(shippingPrice) : null,
        tags,
        status: 'active',
      },
    })

    return res.status(201).json({
      success: true,
      data: {
        ...product,
        sellerName:     seller.name,
        sellerAvatar:   seller.avatar,
        sellerVerified: seller.isAdmin,
        isSaved: false,
      },
    })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' })
    if (existing.sellerId !== userId) return res.status(403).json({ success: false, message: 'Forbidden' })

    const { title, description, price, quantity, hasShipping, shippingPrice, tags } = req.body

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(quantity !== undefined && { quantity: Number(quantity) }),
        ...(hasShipping !== undefined && { hasShipping }),
        ...(shippingPrice !== undefined && { shippingPrice: shippingPrice ? Number(shippingPrice) : null }),
        ...(tags !== undefined && { tags }),
      },
    })

    return ok(res, updated)
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function toggleProductStatus(req: Request, res: Response) {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' })
    if (existing.sellerId !== userId) return res.status(403).json({ success: false, message: 'Forbidden' })

    const newStatus = existing.status === 'active' ? 'paused' : 'active'
    const updated = await prisma.product.update({ where: { id }, data: { status: newStatus } })
    return ok(res, updated)
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' })
    if (existing.sellerId !== userId) return res.status(403).json({ success: false, message: 'Forbidden' })

    await prisma.product.delete({ where: { id } })
    return ok(res, { id })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}

export async function saveProduct(req: Request, res: Response) {
  try {
    const { id } = req.params
    const userId = (req as any).userId

    const existing = await prisma.productSave.findUnique({ where: { productId_userId: { productId: id, userId } } })
    if (existing) {
      await prisma.productSave.delete({ where: { productId_userId: { productId: id, userId } } })
      await prisma.product.update({ where: { id }, data: { saves: { decrement: 1 } } }).catch(() => {})
      return ok(res, { saved: false })
    }

    await prisma.productSave.create({ data: { productId: id, userId } })
    await prisma.product.update({ where: { id }, data: { saves: { increment: 1 } } }).catch(() => {})
    return ok(res, { saved: true })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}
