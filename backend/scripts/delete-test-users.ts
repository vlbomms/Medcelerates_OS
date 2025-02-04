import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteTestUsers() {
  try {
    // Delete all tests associated with test users
    await prisma.test.deleteMany({
      where: {
        user: {
          email: {
            contains: '@gmail.com' // Adjust this filter as needed
          }
        }
      }
    });

    // Delete the test users
    const result = await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@gmail.com' // Adjust this filter as needed
        }
      }
    });

    console.log(`Deleted ${result.count} test users`);
  } catch (error) {
    console.error('Error deleting test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteTestUsers();