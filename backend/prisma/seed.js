async function main() {
  // 1 admin
  await prisma.user.create({
    data: {
      email: 'admin@pharma.com',
      password: 'hashé123',
      firstName: 'Admin',
      lastName: 'Principal',
      role: 'ADMIN'
    }
  })

  // 2 catégories
  const sante = await prisma.category.create({
    data: { name: 'Santé' }
  })
  
  const beaute = await prisma.category.create({
    data: { name: 'Beauté' }
  })

  // 3 produits
  await prisma.product.createMany({
    data: [
      { name: 'Vitamine C', price: 120, categoryId: sante.id, stockQuantity: 50 },
      { name: 'Crème hydratante', price: 180, categoryId: beaute.id, stockQuantity: 30 }
    ]
  })
}
