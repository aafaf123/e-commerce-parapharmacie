import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testProductUpdate() {
  console.log('🧪 Testing product update persistence...');

  // Get the first product
  const product = await prisma.product.findFirst({
    include: {
      productVariants: true
    }
  });

  if (!product) {
    console.log('❌ No product found');
    return;
  }

  console.log(`📦 Product: ${product.name} (ID: ${product.id})`);
  console.log(`📊 Before update: HT=${product.priceHT}, TTC=${product.priceTTC}, category=${product.categoryId}, subcategory=${product.subcategoryId}, item=${product.subcategoryItemId}`);

  if (product.productVariants.length > 0) {
    console.log(`📊 Variants: ${product.productVariants.length}`);
    product.productVariants.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.value}: HT=${v.priceHT}, TTC=${v.priceTTC}`);
    });
  }

  // Simulate an update
  const updateData = {
    priceHT: (product.priceHT || 10) + 1, // Increment by 1
    priceTTC: (product.priceTTC || product.price || 12) + 1.2,
    categoryId: product.categoryId, // Keep same
    subcategoryId: product.subcategoryId,
    subcategoryItemId: product.subcategoryItemId
  };

  console.log('🔄 Updating with:', updateData);

  await prisma.product.update({
    where: { id: product.id },
    data: updateData
  });

  // Fetch updated product
  const updatedProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: {
      productVariants: true
    }
  });

  console.log(`📊 After update: HT=${updatedProduct.priceHT}, TTC=${updatedProduct.priceTTC}, category=${updatedProduct.categoryId}, subcategory=${updatedProduct.subcategoryId}, item=${updatedProduct.subcategoryItemId}`);

  await prisma.$disconnect();
  console.log('✅ Test completed');
}

testProductUpdate().catch(console.error);