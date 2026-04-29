// Script to remove duplicate promotions (keep only the first 3)
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate promotions...')
  
  try {
    // Get all promotions ordered by creation date
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'asc' }
    })
    
    console.log(`Found ${promotions.length} total promotions`)
    
    // Keep only the first 3 (original ones), delete the rest
    if (promotions.length > 3) {
      const duplicates = promotions.slice(3)
      console.log(`Found ${duplicates.length} duplicate promotions to delete`)
      
      for (const dup of duplicates) {
        await prisma.promotion.delete({
          where: { id: dup.id }
        })
        console.log(`🗑️ Deleted: ${dup.title}`)
      }
      
      console.log('✅ Cleanup complete!')
    } else {
      console.log('✅ No duplicates found!')
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupDuplicates()